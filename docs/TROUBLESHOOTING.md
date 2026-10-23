# Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Backend refuses to start with `APP_ENV=production` | Weak/missing `JWT_SECRET` (32+ chars), missing `DATABASE_URL`, wildcard `CORS_ORIGINS`, or `DEBUG` on. Check server logs (the reason is logged, not shown to users). |
| Browser shows CORS error | Add the exact frontend origin (no trailing slash) to `CORS_ORIGINS`/`FRONTEND_URL` on the backend and redeploy. |
| Frontend calls wrong URL in production | Set `VITE_API_URL` at build time (e.g. `https://<backend>/api/v1`) and rebuild; Vite bakes it in. |
| API 404 on page refresh (frontend) | SPA rewrite missing; use the provided `frontend/vercel.json`, `netlify.toml` or `nginx.conf`. |
| First request very slow on Render | Free instances sleep when idle; wait or use a paid plan. |
| Database connection fails on Supabase | Check connection string, password, TLS; the project may be paused (check current Supabase terms). See [SUPABASE_SETUP.md](deployment/SUPABASE_SETUP.md). |
| RLS seems to do nothing | You are connected as `postgres` (bypasses RLS). Use the `creatorhub_app` role. |
| Content shows "Sample content" | No `OPENAI_API_KEY` (expected demo mode) or key not loaded; set it on the backend and restart. |
| 503 `AI_UNAVAILABLE` | OpenAI error/timeout or quota; see server logs. OpenAI usage is billed by OpenAI. |
| 429 `RATE_LIMITED` | AI limits (`AI_RATE_LIMIT_PER_MINUTE`, `AI_DAILY_LIMIT_PER_USER`) or login limit (10/min/IP). Wait a minute. |
| Logged out after redeploy/restart | JWT secret changed, or in-memory revocation state reset. |
| Token still valid after logout on another instance | Revocation list is in-memory per instance; use a shared store for multi-instance. |
| Forgot-password sends no email | Email delivery is not implemented; in dev/demo the reset token is logged on the server only. |
| No Google sign-in button | Not implemented. |
| Demo accounts missing | `AUTO_SEED` false, or DB not empty at startup; apply `database/seed.sql` or run with `AUTO_SEED=true` on an empty DB. |
| `pytest` cannot find tests | Run from `backend/`: `python -m pytest ../tests -q`. |
| Trends/competitors say sample | No `YOUTUBE_API_KEY` or YouTube call failed; sample data is labelled. |
| Port in use | Backend 8000, frontend dev 5173; change the port or stop the other process. |
