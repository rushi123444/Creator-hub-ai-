# CreatorHub AI - Database

Source of truth: `backend/app/models/*.py`. SQL: [schema.sql](../database/schema.sql), [migrations/](../database/migrations/) (`0001_initial_schema.sql`, `0002_row_level_security.sql`). Setup: [SUPABASE_SETUP.md](deployment/SUPABASE_SETUP.md). ER diagram: [ARCHITECTURE.md](ARCHITECTURE.md#8-entity-relationship-diagram-main-tables).

Conventions: UUID primary keys for user data (integer/string keys for reference tables); timestamps are timezone-aware UTC; JSON columns are `jsonb` on PostgreSQL; portable types so SQLite works locally. Constraint naming: `pk_`, `uq_`, `ix_`, `ck_<table>_<name>`, `fk_`. Tables with `created_at`+`updated_at` (marked "TS") get an `updated_at` trigger in `schema.sql`.

`DATABASE_URL` picks the engine (`sqlite:///./creatorhub.db` by default; `postgresql://` is rewritten to the `psycopg` v3 driver). Demo data: `AUTO_SEED=true`, or generate `database/seed.sql` with `python -m app.scripts.export_seed_sql > database/seed.sql` and apply with `psql "<connection string>" -f database/seed.sql`.

## Reference tables

| Table | Columns | Constraints |
|---|---|---|
| `languages` | `code` (PK, varchar 5: en/hi/mr), `name`, `native_name`, `is_active` | |
| `platforms` | `id` (int PK), `slug`, `name`, `is_active` | `slug` unique |
| `categories` | `id` (int PK), `name`, `slug`, `description`, `is_active`, `created_at` | `name`, `slug` unique |

## Accounts

| Table | Key columns | Notes |
|---|---|---|
| `users` (TS) | `id`, `email` (unique), `password_hash`, `full_name`, `role`, `is_active`, `last_login_at` | CHECK role in creator/editor/admin |
| `profiles` (TS) | `user_id` (unique, FK CASCADE), `username` (unique), `avatar_url`, `bio`, `preferred_language`, `ui_language` (FK languages), `profile_completed` | one per user |
| `creator_profiles` (TS) | `user_id` (unique, CASCADE), `category_id`, `platform_id` (SET NULL), `creator_type`, `experience_level`, `interests` (json), `default_tone` | personalises AI prompts |
| `editor_profiles` (TS) | `user_id` (nullable, unique, CASCADE), `display_name`, `headline`, `specialization`, `languages` (json), `experience_years`, `portfolio_url`, `instagram_url`, `contact_email`, `avatar_url`, `bio`, `is_verified`, `status` | CHECK status active/flagged/suspended; CHECK specialization reels/youtube/motion_graphics/thumbnail/gaming; index on specialization. `user_id` NULL = admin-managed listing |
| `editor_skills` | `id`, `editor_id` (FK CASCADE), `skill` | UNIQUE (editor_id, skill) |

## Creator workspace

| Table | Key columns | Notes |
|---|---|---|
| `content` (TS) | `user_id` (CASCADE), `title`, `topic`, `content_type`, `platform_id`, `category_id` (SET NULL), `language_code`, `status`, `body`, `caption`, `hashtags` (json), `notes`, `ai_generated`, `scheduled_at`, `published_at` | CHECK status in idea/draft/script/recording/editing/scheduled/published; index (user_id, status) |
| `content_ideas` | `user_id`, `title`, `topic`, `format`, `reason`, `suggested_hook`, `category_id`, `platform_id`, `language_code`, `is_saved`, `created_at` | |
| `scripts` | `user_id`, `content_id` (SET NULL), `topic`, `hook`, `introduction`, `main_points`, `examples` (json), `cta`, `ending`, `full_script`, `language_code`, `platform_id`, `duration_seconds`, `tone`, `created_at` | |
| `hooks` | `user_id`, `content_id`, `topic`, `hook_type`, `text`, `language_code`, `platform_id`, `is_saved`, `created_at` | CHECK hook_type question/curiosity/problem/benefit/story |
| `captions` | `user_id`, `content_id`, `topic`, `instagram_caption`, `youtube_description`, `short_description`, `cta`, `keywords` (json), `language_code`, `platform_id`, `is_saved`, `created_at` | |
| `hashtags` | `user_id`, `content_id`, `topic`, `broad`, `medium`, `niche` (json), `language_code`, `platform_id`, `is_saved`, `created_at` | |
| `content_calendar` (TS) | `user_id`, `content_id` (SET NULL), `title`, `platform_id`, `status`, `scheduled_at` (required), `notes` | same status CHECK as content; index (user_id, scheduled_at) |

All `user_id` FKs are `ON DELETE CASCADE` and indexed; `platform_id`/`category_id` FKs are `SET NULL`; `language_code` FKs to `languages.code`.

## Insights

| Table | Key columns | Notes |
|---|---|---|
| `trends` | `topic`, `category_id`, `platform_id`, `language_code`, `trend_score`, `score_breakdown` (json: recency/growth/engagement/frequency), `growth_pct`, `engagement_rate`, `content_count`, `topic_frequency`, `related_topics`, `history` (json), `source`, `is_sample`, `is_active`, `last_updated`, `created_at` | CHECK 0 <= trend_score <= 100; index (category_id, platform_id). Score is project-defined, not a platform metric |
| `trend_topics` | `id` (int), `trend_id` (CASCADE), `keyword`, `frequency`, `created_at` | feeds the keyword-frequency chart |
| `analytics` | `user_id` (CASCADE), `content_id` (SET NULL), `title`, `topic`, `platform_id`, `category_id`, `language_code`, `recorded_on`, `publication_date`, `duration_seconds`, `views`, `likes`, `comments`, `shares`, `saves`, `reach` (nullable), `watch_time_minutes`, `followers_gained`, `created_at` | index (user_id, recorded_on); null reach => views-based engagement. Model class `AnalyticsEntry` |
| `competitors` | `user_id` (CASCADE), `platform_id`, `handle_or_url`, `display_name`, `analysis` (json), `is_sample`, `created_at` | public data only |
| `recommendations` | `user_id` (nullable = global), `kind`, `title`, `description`, `rationale`, `category_id`, `platform_id`, `language_code`, `is_dismissed`, `created_at` | CHECK kind topic/format/timing/language/platform/engagement |

## System

| Table | Key columns | Notes |
|---|---|---|
| `ai_requests` | `user_id` (nullable, SET NULL), `feature`, `language_code`, `status`, `model`, `latency_ms`, `input_chars`, `output_chars`, `created_at` | CHECK status success/sample/error; index (user_id, created_at). Metadata only - no prompts, outputs or keys |
| `reports` (TS) | `reporter_id` (SET NULL), `target_type`, `target_id` (no FK; polymorphic), `reason`, `details`, `status`, `resolution_note`, `resolved_by` (SET NULL) | CHECK status open/reviewing/resolved/dismissed; CHECK target_type editor_profile/creator_profile/content |
| `notifications` | `user_id` (CASCADE), `title`, `body`, `kind`, `link`, `is_read`, `created_at` | index (user_id, is_read) |
| `platform_settings` | `key` (PK), `value` (json), `updated_at` | keys `open_registration`, `ai_daily_limit_per_user`, `announcement` |

That is 24 tables (23 core + `platform_settings`).

## Row Level Security

Policies live in `0002_row_level_security.sql` and use the session settings `app.current_user_id` / `app.current_role`. They apply only when the app connects as the non-bypass role `creatorhub_app`. Design and limits (including that live-PostgreSQL verification is not recorded in this repo): [ARCHITECTURE.md section 7](ARCHITECTURE.md#7-security-model).

## Applying

```bash
psql "<connection string>" -f database/schema.sql       # idempotent; or run migrations/0001 then 0002
python -m app.scripts.create_admin                       # needs ADMIN_EMAIL / ADMIN_PASSWORD env vars
```
