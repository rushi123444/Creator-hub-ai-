# Production Checklist

**Config**
- [ ] `APP_ENV=production`, `DEBUG` unset/false, `AUTO_SEED=false`
- [ ] `JWT_SECRET` random, 32+ chars, stored only in the host's secret store
- [ ] `DATABASE_URL` points at managed PostgreSQL with `sslmode=require`
- [ ] `CORS_ORIGINS` / `FRONTEND_URL` list exact HTTPS origins, no `*`
- [ ] `.env` files not committed (check `git status` and history)

**Data and access**
- [ ] `database/schema.sql` applied; no demo accounts (`creator@creatorhub.ai`, `editor@...`, `admin@...`) exist
- [ ] Real admin created with `python -m app.scripts.create_admin`
- [ ] Consider connecting as `creatorhub_app` (RLS enforced) rather than a bypass role
- [ ] Database backups enabled and a restore tested (check your provider's terms)

**Security**
- [ ] HTTPS everywhere; security headers present (vercel.json / netlify.toml / nginx.conf)
- [ ] Rotate any key that was ever pasted into chat, logs or a repo
- [ ] Token revocation is in-memory: use a single instance or add a shared store (e.g. Redis) before scaling out
- [ ] OpenAI spend limit set in the OpenAI dashboard (usage is billed by OpenAI); `AI_DAILY_LIMIT_PER_USER` reviewed

**Operations**
- [ ] `/health` and `/ready` monitored; uptime pinger if on a sleeping free tier (verify current terms)
- [ ] Billing alarms/budgets on every paid or free-tier-limited provider
- [ ] Logs reviewed; `LOG_LEVEL=INFO`
- [ ] Smoke test passed (steps 9 to 12 in FREE_DEPLOYMENT.md)

**Known limits**: Google sign-in and password-reset email delivery are not implemented; Render free instances sleep; Supabase free projects may pause.
