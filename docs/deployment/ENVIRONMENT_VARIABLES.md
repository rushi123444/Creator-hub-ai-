# Environment Variables

Backend variables are read by `backend/app/config/settings.py` (case-insensitive, `.env` supported). Placeholders only; never commit real values.

| Name | Required? | Where used | Placeholder | Secret? |
|---|---|---|---|---|
| `APP_ENV` | no (default `development`) | backend | `production` | no |
| `DEBUG` | no; must be false in production | backend | `false` | no |
| `DATABASE_URL` | **production** (dev: SQLite) | backend | `postgresql+psycopg://postgres:<PASSWORD>@<HOST>:5432/postgres?sslmode=require` | **yes** |
| `JWT_SECRET` | **production** (min 32 chars) | backend | `<random 48+ chars>` | **yes** |
| `JWT_EXPIRE_MINUTES` | no (60) | backend | `60` | no |
| `JWT_REMEMBER_EXPIRE_MINUTES` | no (43200) | backend | `43200` | no |
| `FRONTEND_URL` | recommended | backend (CORS default) | `https://your-app.vercel.app` | no |
| `CORS_ORIGINS` | production; no `*` | backend | `https://your-app.vercel.app` | no |
| `OPENAI_API_KEY` | no (blank = sample mode) | backend | `<openai key>` | **yes** |
| `OPENAI_MODEL` | no | backend | `gpt-4.1-mini` | no |
| `YOUTUBE_API_KEY` | no | backend | `<google key>` | **yes** |
| `SUPABASE_URL` | no | backend | `https://<ref>.supabase.co` | no |
| `SUPABASE_KEY` | no | backend | `<anon key>` | semi |
| `SUPABASE_SERVICE_ROLE_KEY` | no | backend only | `<service role key>` | **yes** |
| `AUTO_SEED` | no (true dev/demo, false prod) | backend | `false` | no |
| `AI_RATE_LIMIT_PER_MINUTE` | no (20) | backend | `20` | no |
| `AI_DAILY_LIMIT_PER_USER` | no (200) | backend | `200` | no |
| `LOG_LEVEL` | no (INFO) | backend | `INFO` | no |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | only for `create_admin` script | one-off command | `<email>` / `<strong password>` | password: **yes** |
| `PORT` | set by host | Procfile / Docker | `8000` | no |
| `VITE_API_URL` | frontend build; default `/api/v1` | frontend (public, baked at build) | `https://your-api.onrender.com/api/v1` | no |
| `POSTGRES_PASSWORD` | only docker-compose postgres profile | compose | `<password>` | **yes** |

Rules
- In production the backend refuses to start if `JWT_SECRET` is missing/weak, `DATABASE_URL` is missing, CORS contains `*`, or `DEBUG` is on. Reasons appear in server logs only.
- Missing OpenAI/YouTube/Supabase keys never stop the app; features show sample data.
- `VITE_*` values are public: never put secrets in them. Changing it requires a frontend rebuild.
- Generate a secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
