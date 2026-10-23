# Netlify Deployment (frontend)

Free-plan limits change: **verify current Netlify terms**.

## 1-4. Database, env vars, migrations, seed
Steps 1 to 4 (database) are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md): create the Supabase project, set `DATABASE_URL`, run `database/schema.sql`, optionally seed. Variables are in [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

## 5. Deploy the backend
Use [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) (or [AWS](AWS_DEPLOYMENT.md)). You need its public URL.

## 6. Configure the frontend API URL
Netlify > Site configuration > Environment variables: `VITE_API_URL` = `https://<your-api-host>/api/v1`. Baked in at build time; trigger a new deploy after changes.

## 7. Deploy the frontend
1. **Add new site > Import an existing project**, pick the repo.
2. Base directory `frontend`; `frontend/netlify.toml` supplies build `npm run build`, publish `dist`, the SPA redirect (`/* -> /index.html`, 200) and security headers.
3. Deploy and note the URL, e.g. `https://creatorhub-ai.netlify.app`.

## 8. Configure CORS
On the backend set `FRONTEND_URL` and `CORS_ORIGINS` to that exact origin (no `*`), then redeploy the backend.

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
