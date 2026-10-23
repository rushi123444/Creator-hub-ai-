# Supabase Setup (PostgreSQL)

Covers deployment steps 1 to 4: create the database, configure env vars, run migrations, seed demo data.

## 1. Create the database
1. Sign in at supabase.com and create a new project. Choose a region near your backend. Save the database password in a password manager.
2. Open **Project Settings > Database > Connection string** and copy the URI (direct, or the pooler URI for IPv4-only hosts such as Render).

## 2. Configure environment variables
Convert the URI for SQLAlchemy and the psycopg driver:
```
DATABASE_URL=postgresql+psycopg://postgres:<PASSWORD>@<HOST>:5432/postgres?sslmode=require
```
`SUPABASE_URL` and keys are optional; the app does not need them. Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

## 3. Run migrations
Either paste `database/schema.sql` into **SQL Editor > New query > Run**, or:
```
psql "postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres?sslmode=require" -f database/schema.sql
```
(`database/migrations/0001_initial_schema.sql` then `0002_row_level_security.sql` are the same content split in two; see `database/migrations/README.md`.) The script is written to be re-runnable.

## 4. Seed demo data
Demo data is optional. Either start the backend once with `AUTO_SEED=true`, or apply the generated file:
```
psql "<connection string>" -f database/seed.sql
```
Never seed demo accounts in production. For a real admin use `python -m app.scripts.create_admin` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set.

## RLS and the app role (important)
The schema enables Row Level Security. Supabase's `postgres` role (the one in the connection string) **bypasses RLS**, so with that URL the real protection is the API's `user_id` checks and JWT roles. RLS only protects you if the backend connects as the restricted `creatorhub_app` role (created in the schema; set its password yourself, never commit it). Using it requires the backend to set `app.current_user_id` / `app.current_role` per request; treat RLS as defence in depth. See `docs/ARCHITECTURE.md`.

## Free tier notes
Free projects have size, bandwidth and inactivity limits, and may be paused after inactivity. **Verify current Supabase terms** on their pricing page. A paused project must be restored in the dashboard before the API works.

## Steps 5 to 12
Continue with [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md): deploy backend, set the frontend API URL, deploy frontend, configure CORS, then test auth, AI generation, database operations and production.
