# Free-Tier Deployment Guide (Supabase + Render + Vercel/Netlify)

Recommended low-cost stack for a demo or student project:

| Layer | Service | Notes (verify current terms) |
|---|---|---|
| Database | Supabase PostgreSQL | free projects may pause when inactive |
| API | Render web service | free instances sleep when idle; cold start delay |
| Frontend | Vercel or Netlify | static hosting |
| AI | OpenAI | **billed by OpenAI**; blank key = free sample mode |

Free tiers can change or require a card; check each provider's pricing page. Sample mode (no `OPENAI_API_KEY`) costs nothing.

```
Browser -> Vercel/Netlify (React build) -> HTTPS -> Render (FastAPI) -> Supabase (PostgreSQL)
                                                          \-> OpenAI / YouTube APIs (optional)
```

## 1-4. Database
Steps 1 to 4 (database) are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md): create the Supabase project, set `DATABASE_URL`, run `database/schema.sql`, optionally seed. Variables are in [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

## 5. Deploy the backend
Follow [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md). Set `API` to the Render URL.

## 6. Configure the frontend API URL
`VITE_API_URL=https://<render-host>/api/v1` on the frontend host.

## 7. Deploy the frontend
[VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) or [NETLIFY_DEPLOYMENT.md](NETLIFY_DEPLOYMENT.md).

## 8. Configure CORS
Set `FRONTEND_URL` and `CORS_ORIGINS` on Render to the frontend origin; redeploy.

## 9. Test authentication
```
curl -s -X POST $API/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","email":"test@example.com","password":"ChangeMe123","role":"creator"}'
```
Expect `access_token`. Then log in through the web app. Register with role `admin` must return 422.

## 10. Test AI generation
Log in, open the AI generator, enter a topic. Without `OPENAI_API_KEY` the result is labelled "Sample content" (`is_sample: true`). With a key, a valid result needs a funded OpenAI account; failures show a friendly "temporarily unavailable" message (503 `AI_UNAVAILABLE`).

## 11. Test database operations
Create a content item, schedule it on the calendar, refresh the page and confirm it persists. In the Supabase **Table Editor**, check `content` has the row. `GET $API/ready` should return `{"status":"ok"}`.

## 12. Test production
- `GET $API/health` returns 200; browser console shows no CORS errors.
- Deep-link (e.g. `/dashboard`) and refresh: the SPA must not 404.
- Logout, then reuse the old token: expect 401.
- Run through [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## Known limits
Render free sleeps (first request may take a while); Supabase free may pause; token revocation is in-memory (single instance only); Google sign-in and password-reset emails are not implemented.
