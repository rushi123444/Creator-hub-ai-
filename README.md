# CreatorHub AI — Create Smarter. Grow With Data.

**AI-Powered Content Creator Environment for Trend Discovery, Content Generation and Performance Analytics**
MSBTE Diploma Final Year Project — Computer Engineering.

An AI-powered, centralized environment that helps content creators discover trends, generate multilingual (English / Hindi / Marathi) content, plan publications and analyze performance from a single platform.

## Features
- **AI Studio**: hooks, scripts, captions, hashtags, titles, CTAs and content ideas; per-section regenerate, copy, edit, save.
- **AI Assistant** chat, **Long-to-Short** repurposing, **Content Analyzer** (never guarantees virality).
- **Trend Discovery** with a project-defined Trend Score (0–100: recency + growth + engagement + topic frequency; *not* an official platform metric).
- **Analytics** with the engagement formula `(Likes + Comments + Shares + Saves) / Reach × 100` (views-based fallback is labelled), charts and recommendations.
- **Content management**, **Content Calendar** (month/week/list), **Competitor/public-content analysis** (public data only), **Editor Directory** (directory/contact only, no payments).
- **Admin panel**: users, creators, editors, categories, trends, content, reports, AI usage, settings.
- **Demo mode**: with no external credentials the app stays fully usable on seeded data and a sample AI generator; users never see setup/technical messages.

## Tech stack
React 18 + Vite, Recharts, lucide-react · FastAPI, SQLAlchemy 2, Pydantic v2 · PostgreSQL (Supabase) / SQLite for local demo · OpenAI Responses API · optional YouTube Data API · JWT + bcrypt.

## Folder structure
```
creatorhub-ai/
  frontend/   React app (src/components, pages, layouts, services, hooks, utils, i18n, styles)
  backend/    FastAPI app (app/config, models, schemas, routers, services, ai, analytics, trends, database)
  database/   schema.sql (tables, indexes, RLS), seed.sql, migrations/
  tests/      pytest suite (109 tests)
  deploy/aws/ AWS deployment configs
  docs/       ARCHITECTURE, API, DATABASE, TESTING, TROUBLESHOOTING, MSBTE_DEMO_GUIDE, deployment/*
```

## Run locally
```bash
# Backend (SQLite + demo data, sample AI mode — no keys needed)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8000)
```
To use real AI, copy `backend/.env.example` to `backend/.env` and set `OPENAI_API_KEY` / `OPENAI_MODEL` (optionally `YOUTUBE_API_KEY`). Never put these in the frontend.

## Demo credentials (development/demo only — change or remove in production)
| Role | Email | Password |
|---|---|---|
| Creator | creator@creatorhub.ai | Creator@123 |
| Editor | editor@creatorhub.ai | Editor@123 |
| Admin | admin@creatorhub.ai | Admin@12345 |

Admin can never be chosen at registration; admin access is enforced by the backend.

## Testing
```bash
cd backend && python -m pytest ../tests -q     # 109 tests
cd frontend && npm run build
```

## Deployment
Full step-by-step guides are in `docs/deployment/`: `FREE_DEPLOYMENT.md` (Vercel/Netlify + Render + Supabase), `VERCEL_DEPLOYMENT.md`, `NETLIFY_DEPLOYMENT.md`, `RENDER_DEPLOYMENT.md`, `AWS_DEPLOYMENT.md` (S3 + CloudFront / Amplify; App Runner / EC2 / Elastic Beanstalk; Supabase or RDS), `SUPABASE_SETUP.md`, `ENVIRONMENT_VARIABLES.md`, `PRODUCTION_CHECKLIST.md`. Flow: create database → set env vars → run `database/schema.sql` → seed → deploy backend → set `VITE_API_URL` → deploy frontend → set CORS → test auth, AI, database, production. Free-tier and AWS Free Tier terms change; verify current terms with each provider.

## Security
bcrypt password hashing, JWT with logout revocation, role-based authorization, input validation, per-user AI rate limits, strict CORS in production, security headers, production startup validation, no secrets/stack traces in responses, Row Level Security in `schema.sql` (defense in depth — see `docs/ARCHITECTURE.md`; RLS only binds database roles without BYPASSRLS, so use a non-bypass application role).

## Known limitations
- Google sign-in and password-reset email delivery are not implemented (reset tokens are logged server-side in dev/demo).
- Token revocation is in-memory; multi-instance deployments need a shared store.
- YouTube live path is tested with mocked responses only; YouTube OAuth analytics is not implemented.
- `schema.sql`/RLS and the deployment configs have not been verified on live cloud services; test them in your own environment.
- Free hosting tiers may sleep or pause; OpenAI usage is billed by OpenAI.

See `docs/MSBTE_DEMO_GUIDE.md` for the presentation script and viva Q&A.
