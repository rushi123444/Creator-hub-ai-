-- =============================================================================
-- CreatorHub AI - 0002 row level security + application role (idempotent)
-- Apply AFTER 0001_initial_schema.sql.
--
-- HOW IT WORKS
--   The backend uses its own JWT auth (not Supabase Auth). For each request it runs
--     SELECT set_config('app.current_user_id', '<uuid>', true);
--     SELECT set_config('app.current_role',    '<creator|editor|admin|system>', true);
--   (transaction-local) and the policies below read those settings.
--   Register / login / password reset / seeding use role 'system'.
--
-- !! RLS ONLY BINDS ROLES WITHOUT BYPASSRLS !!
--   * Superusers and the table owner bypass RLS. Supabase's default `postgres` role
--     has BYPASSRLS, so connecting the app as `postgres` disables every policy here.
--   * Run this migration as `postgres` (owner), then point the app's DATABASE_URL at
--     the NOBYPASSRLS role `creatorhub_app` created below.
--   * Application-level authorization (user_id checks in the API) remains the primary
--     control; RLS is defense in depth.
--
-- FORCE ROW LEVEL SECURITY
--   Not used by default: with a separate app role the owner is only used for
--   migrations/maintenance and SHOULD be able to bypass. FORCE only matters when the
--   app connects as the table OWNER and that owner is neither superuser nor BYPASSRLS
--   (e.g. a plain Docker Postgres user). In that setup uncomment the FORCE loop at the
--   bottom - but then migrations/seeding must set app.current_role = 'system' first.
-- =============================================================================

-- ---------- helper functions --------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.current_user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_current_role() RETURNS text
LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('app.current_role', true), ''), 'anonymous') $$;

-- true for admin / system contexts
CREATE OR REPLACE FUNCTION app_is_privileged() RETURNS boolean
LANGUAGE sql STABLE AS
$$ SELECT app_current_role() IN ('admin','system') $$;

-- ---------- application role (never BYPASSRLS) --------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'creatorhub_app') THEN
    -- NOLOGIN until you set a password yourself (see database/migrations/README.md):
    --   ALTER ROLE creatorhub_app WITH LOGIN PASSWORD '<generate-a-strong-password>';
    CREATE ROLE creatorhub_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  ELSE
    ALTER ROLE creatorhub_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- ---------- policies ----------------------------------------------------------
-- Macro-style loop: user-owned tables (user_id NOT NULL) -> owner or admin/system.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','creator_profiles','content','content_ideas','scripts',
                           'hooks','captions','hashtags','content_calendar','analytics',
                           'competitors','notifications']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_owner_or_admin', t);
    EXECUTE format($p$CREATE POLICY %I ON %I FOR ALL
        USING (user_id = app_current_user_id() OR app_is_privileged())
        WITH CHECK (user_id = app_current_user_id() OR app_is_privileged())$p$,
        t || '_owner_or_admin', t);
  END LOOP;
END $$;

-- users: self or admin/system
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self_or_admin ON users;
CREATE POLICY users_self_or_admin ON users FOR ALL
  USING (id = app_current_user_id() OR app_is_privileged())
  WITH CHECK (id = app_current_user_id() OR app_is_privileged());

-- recommendations: user_id NULL = global (readable by everyone, writable by admin/system)
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recommendations_select ON recommendations;
DROP POLICY IF EXISTS recommendations_write ON recommendations;
CREATE POLICY recommendations_select ON recommendations FOR SELECT
  USING (user_id IS NULL OR user_id = app_current_user_id() OR app_is_privileged());
CREATE POLICY recommendations_write ON recommendations FOR ALL
  USING (user_id = app_current_user_id() OR app_is_privileged())
  WITH CHECK (user_id = app_current_user_id() OR app_is_privileged());

-- ai_requests: owner (or admin/system) reads; only 'system' writes
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_requests_select ON ai_requests;
DROP POLICY IF EXISTS ai_requests_system_write ON ai_requests;
CREATE POLICY ai_requests_select ON ai_requests FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_privileged());
CREATE POLICY ai_requests_system_write ON ai_requests FOR ALL
  USING (app_current_role() = 'system')
  WITH CHECK (app_current_role() = 'system');

-- reports: reporter inserts and reads own; admin/system everything
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_insert_own ON reports;
DROP POLICY IF EXISTS reports_select_own ON reports;
DROP POLICY IF EXISTS reports_admin_all ON reports;
CREATE POLICY reports_insert_own ON reports FOR INSERT
  WITH CHECK (reporter_id = app_current_user_id());
CREATE POLICY reports_select_own ON reports FOR SELECT
  USING (reporter_id = app_current_user_id());
CREATE POLICY reports_admin_all ON reports FOR ALL
  USING (app_is_privileged()) WITH CHECK (app_is_privileged());

-- editor_profiles / editor_skills: public SELECT (directory); writes admin/system.
-- ADDITION to the contract: an editor may also write their OWN row (self-service
-- "My Editor Profile"); without it the editor endpoint would need the 'system' role.
-- The API still filters the public directory to status = 'active'.
ALTER TABLE editor_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS editor_profiles_select ON editor_profiles;
DROP POLICY IF EXISTS editor_profiles_write ON editor_profiles;
CREATE POLICY editor_profiles_select ON editor_profiles FOR SELECT USING (true);
CREATE POLICY editor_profiles_write ON editor_profiles FOR ALL
  USING (user_id = app_current_user_id() OR app_is_privileged())
  WITH CHECK (user_id = app_current_user_id() OR app_is_privileged());

ALTER TABLE editor_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS editor_skills_select ON editor_skills;
DROP POLICY IF EXISTS editor_skills_write ON editor_skills;
CREATE POLICY editor_skills_select ON editor_skills FOR SELECT USING (true);
CREATE POLICY editor_skills_write ON editor_skills FOR ALL
  USING (app_is_privileged() OR EXISTS (
          SELECT 1 FROM editor_profiles e
          WHERE e.id = editor_skills.editor_id AND e.user_id = app_current_user_id()))
  WITH CHECK (app_is_privileged() OR EXISTS (
          SELECT 1 FROM editor_profiles e
          WHERE e.id = editor_skills.editor_id AND e.user_id = app_current_user_id()));

-- reference / trend / settings tables: public SELECT, writes admin/system
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['languages','platforms','categories','trends','trend_topics','platform_settings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_public', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_write_admin', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', t || '_select_public', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (app_is_privileged()) WITH CHECK (app_is_privileged())',
                   t || '_write_admin', t);
  END LOOP;
END $$;

-- ---------- grants ------------------------------------------------------------
-- Minimal grants for the app role: DML only, no DDL, no TRUNCATE, no superuser powers.
GRANT USAGE ON SCHEMA public TO creatorhub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO creatorhub_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO creatorhub_app;
GRANT EXECUTE ON FUNCTION app_current_user_id(), app_current_role(), app_is_privileged() TO creatorhub_app;
-- Tables created later by this owner (future migrations) get the same grants:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO creatorhub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO creatorhub_app;

-- ---------- Supabase: keep the auto-generated REST API closed -------------------
-- Supabase exposes the public schema through PostgREST to roles anon/authenticated.
-- CreatorHub never uses that API, so remove their table access (no-op elsewhere).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
  END IF;
END $$;

-- ---------- optional FORCE (see header) ----------------------------------------
-- DO $$ DECLARE r record; BEGIN
--   FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity LOOP
--     EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tablename);
--   END LOOP; END $$;
