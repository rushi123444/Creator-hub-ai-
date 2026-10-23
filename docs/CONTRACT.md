# CreatorHub AI — Build Contract

Single source of truth for every part of the build. Backend, frontend, database and docs must all
match this file. Table columns live in `backend/app/models/*.py` (read those, do not redefine).

## 1. Stack and conventions

- Backend: Python 3.11, FastAPI, SQLAlchemy 2.0 (sync sessions), Pydantic v2, pydantic-settings.
- DB: PostgreSQL in production (Supabase), SQLite file for local demo + in-memory SQLite for tests.
  Models use portable types only. `DATABASE_URL` selects the engine.
- Frontend: Vite + React 18 + react-router-dom 6 + lucide-react + recharts. Plain CSS with design
  tokens (no Tailwind, no UI kit). JavaScript (JSX), not TypeScript.
- API prefix: `/api/v1`. JSON only. Timestamps ISO-8601 UTC (`2026-10-01T12:00:00Z`). Dates `YYYY-MM-DD`.
- IDs: UUID strings for user data; ints for categories/platforms; string codes for languages (`en|hi|mr`).
- Reference slugs. Platforms: `instagram`, `youtube`, `youtube_shorts`, `facebook`, `x`, `linkedin`, `other`.
  Categories: Technology, Education, Gaming, Business, Entertainment, Fitness (slug = lowercase).
- Content statuses: `idea, draft, script, recording, editing, scheduled, published`.
- Content types: `reel, youtube_short, youtube_video, educational, tutorial, post, caption, other`.
- Tones: `educational, professional, funny, storytelling, motivational, casual, curious`.
- Editor specializations: `reels, youtube, motion_graphics, thumbnail, gaming`.

## 2. Modes and environment

`APP_ENV` = `development` | `demo` | `production` (default `development`).

| Variable | Notes |
|---|---|
| `DATABASE_URL` | default `sqlite:///./creatorhub.db` in development/demo; REQUIRED in production |
| `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | optional; never sent to the frontend |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | optional; default model `gpt-4.1-mini` |
| `YOUTUBE_API_KEY` | optional |
| `JWT_SECRET` | REQUIRED in production (min 32 chars); dev default allowed only outside production |
| `JWT_EXPIRE_MINUTES` (default 60), `JWT_REMEMBER_EXPIRE_MINUTES` (default 43200) | |
| `FRONTEND_URL`, `CORS_ORIGINS` (comma separated) | production: no `*`; dev: `http://localhost:5173` |
| `AUTO_SEED` | `true` seeds demo data on startup if DB is empty (default true in development/demo, false in production) |
| `AI_RATE_LIMIT_PER_MINUTE` (default 20), `AI_DAILY_LIMIT_PER_USER` (default 200) | |
| `LOG_LEVEL` | default INFO |

Startup validation (`config/settings.py`): in production, missing/weak `JWT_SECRET`, missing `DATABASE_URL`,
wildcard CORS, or `DEBUG` => log the technical reason server-side and refuse to start. Missing optional
integrations (OpenAI/YouTube/Supabase) NEVER stop the app; they only switch features to sample mode and are logged.

## 3. Response and error conventions

- Success: return the resource or `{ "items": [...], "total": n }` for lists. No envelope.
- Errors (every non-2xx): `{ "error": { "code": "<UPPER_SNAKE>", "message": "<safe, user-friendly>" } }`.
  Never include stack traces, SQL, env names, keys or provider error text. Log those server-side only.
  Validation errors => 422 with code `VALIDATION_ERROR` and a friendly message (+ optional `fields`).
- Codes: `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `VALIDATION_ERROR` 422,
  `RATE_LIMITED` 429, `AI_UNAVAILABLE` 503, `SERVER_ERROR` 500.
- Friendly messages: AI failure => `AI generation is temporarily unavailable. Please try again.`
  Live-data failure => `Live data is temporarily unavailable. Showing available sample insights.`
  Generic => `Something went wrong. Please try again.`

## 4. Authentication and authorization

- Email + password. Passwords hashed with bcrypt. JWT (HS256) bearer tokens in `Authorization: Bearer <token>`.
  Claims: `sub` (user id), `role`, `jti`, `exp`. Logout revokes the `jti` (DB-independent in-memory denylist
  with expiry pruning is acceptable; document that multi-instance deploys should use a shared store).
- Register accepts role `creator` or `editor` ONLY. Any other value (including `admin`) => 422. Admin accounts are
  created via seed (demo) or `python -m app.scripts.create_admin` reading `ADMIN_EMAIL`/`ADMIN_PASSWORD` env.
- Dependencies: `get_current_user`, `require_roles("admin")`, `require_roles("creator","admin")` etc.
  Users only ever read/write rows where `user_id == current_user.id`. Admin routes require role `admin`.
- Login rate limiting: 10 attempts/minute/IP. Generic failure message `Incorrect email or password.`
- Forgot password: always returns `{ "ok": true }` (no account enumeration). In dev/demo the reset token is logged
  server-side only; email delivery is out of scope and documented as such. Reset: `POST /auth/reset-password`.
- "Continue with Google" is NOT implemented (documented as future work); do not render the button.

## 5. Endpoints (all under `/api/v1`, bearer auth unless marked public)

### System (no prefix)
`GET /health` (liveness, public), `GET /ready` (DB check, public, returns only `{status}`).

### Auth / profile / meta
- `POST /auth/register` {full_name, email, password(min 8), role} -> {access_token, token_type, user}
- `POST /auth/login` {email, password, remember_me?} -> {access_token, token_type, user}
- `POST /auth/logout` -> {ok:true}
- `POST /auth/forgot-password` {email} public -> {ok:true}; `POST /auth/reset-password` {token, new_password} public
- `GET /auth/me` -> user object
- `user` object: `{id, email, full_name, role, profile:{username, avatar_url, bio, preferred_language, ui_language, profile_completed}, creator_profile:{category_id, platform_id, creator_type, experience_level, interests[], default_tone}|null}`
- `GET /profiles/me`, `PUT /profiles/me` (accepts the union of profile + creator_profile fields + full_name; sets `profile_completed`)
- `GET /meta` public -> {categories[], languages[], platforms[], content_types[], tones[], statuses[]}

### AI (rate limited; every response includes `is_sample: bool` and `model`)
Common request fields: `topic, language(en|hi|mr), platform(slug), category(name or slug), audience, tone, duration_seconds, content_type, instructions`.
Profile data (category, language, platform, tone, creator_type, experience, interests) personalises prompts when fields are omitted.
- `POST /ai/generate` -> `{title, hooks:[{type,text}], script:{hook,introduction,main_points[],examples[],cta,ending,full_script}, caption:{instagram_caption,youtube_description,short_description,cta,keywords[]}, hashtags:{broad[],medium[],niche[]}, cta, ideas:[{title,topic,format,reason,suggested_hook}], is_sample, model}`
- `POST /ai/hooks` -> `{hooks:[{type,text}]}` one each of question, curiosity, problem, benefit, story
- `POST /ai/script` -> `{script:{...as above}}`
- `POST /ai/caption` -> `{caption:{...}}`; `POST /ai/hashtags` -> `{hashtags:{broad,medium,niche}}`
- `POST /ai/ideas` -> `{ideas:[{title,topic,format,reason,suggested_hook}]}` (uses current trends + profile)
- `POST /ai/regenerate` {section: hooks|hook|script|caption|hashtags|title|cta|ideas, hook_type?, params:{...common fields}, current?} -> `{section, value, is_sample}`
- `POST /ai/assistant` {messages:[{role:user|assistant, content}], language?} -> `{message:{role:"assistant",content}, is_sample}`. Stateless; the frontend stores history per user in localStorage.
- `POST /ai/long-to-short` {source_text(min 80 chars), target_platform?, language, target_duration_seconds?} -> `{shorts:[{short_idea,hook,suggested_duration_seconds,key_section,short_script,cta}] (3 items), is_sample}`
- `POST /ai/summarize` {text, language} -> {summary}; `POST /ai/classify-topic` {text} -> {category, confidence_label}
- Saving generated output: `POST /hooks`, `/captions`, `/hashtags`, `/scripts`, `/ideas` (body = the stored shape; returns the row);
  `GET` list and `DELETE /{id}` for each. `POST /scripts/{id}/save-to-content` creates a `content` row (status `script`).
- AI behaviour: if no `OPENAI_API_KEY` => deterministic sample generator in en/hi/mr (`is_sample:true`, labelled in UI as "Sample content").
  If key present => OpenAI **Responses API** (`client.responses.create`, JSON-schema structured output, timeout 30s, 1 retry on 429/5xx/timeout);
  on final failure or invalid/empty output => 503 `AI_UNAVAILABLE`. Every call writes an `ai_requests` row (metadata only).
  Enforce per-minute and per-day limits (429 `RATE_LIMITED`, friendly message).

### Trends
- `GET /trends?platform=&category=&language=&days=&q=&sort=score|growth|engagement&limit=` -> `{items:[trend], charts:{growth:[{date,score,...topic series}], frequency:[{keyword,frequency}], categories:[{category,avg_score,count}]}, source:"live"|"sample", note:string|null, score_definition:"Trend Score is a project-defined analytical score (0-100) combining recency, growth, engagement and topic frequency. It is not an official platform metric."}`
- `trend` = `{id, topic, category, platform, language, trend_score, score_breakdown:{recency,growth,engagement,frequency}, growth_pct, engagement_rate, content_count, related_topics[], source, last_updated, is_sample, history[]}`
- `GET /trends/{id}`; `POST /trends/refresh` (tries YouTube if key configured, else sample; always 200 with `{source, updated}`).
- Trend Score = recency(0-25) + growth(0-25) + engagement(0-25) + frequency(0-25), each min-max normalised, total clamped 0-100.

### Analytics / analyzer / recommendations / dashboard
- `GET /analytics/summary?start=&end=&platform=&category=&language=` ->
  `{totals:{views,likes,comments,shares,saves,reach,watch_time_minutes,followers_gained}, engagement:{rate, basis:"reach"|"views", formula, label}, series:{views:[{date,value}], engagement:[{date,value}]}, by_platform[], by_category[], by_language[], by_content[], has_data}`
- Engagement Rate = (likes + comments + shares + saves) / reach x 100. If reach is missing or 0 for the whole selection, use views and set `basis:"views"` with label `Engagement rate (views-based)`.
- `GET /analytics/entries`, `POST /analytics/entries`, `PUT /analytics/entries/{id}`, `DELETE /analytics/entries/{id}` (fields = model columns; platform/category by slug/name)
- `POST /analytics/analyze` {title, topic, description, duration_seconds, category, language, views, likes, comments, shares, publication_date, reach?} ->
  `{performance:{label,summary}, engagement:{rate,basis,formula}, content_pattern, potential_strengths[], observations[], experiment_suggestions[], disclaimer}`. Never promises virality; disclaimer always present.
- `GET /recommendations`; `POST /recommendations/generate` (rule-based on user analytics + trends + profile, AI-worded when available); `POST /recommendations/{id}/dismiss`. Wording is analytical, never guarantees outcomes.
- `GET /dashboard` -> `{greeting_name, stats:{total_views,engagement_rate,saved_ideas,scheduled_posts,ai_generations}, trending:[trend], recent_content:[content], upcoming:[calendar], recommendations:[...], charts:{views:[], engagement:[], platform:[], category:[]}, is_sample_data}`

### Competitor / public analysis
- `POST /competitors/analyze` {platform, handle_or_url} -> saved analysis `{id, display_name, topics[], titles[], posting_frequency, avg_duration_seconds, views, likes, comments, categories[], frequent_topics[], popular_formats[], posting_patterns[], content_gaps[], is_sample, note}`.
  Uses YouTube Data API public endpoints when `YOUTUBE_API_KEY` set and platform is YouTube; otherwise sample public-style data labelled sample. Copy must state it uses public information only.
- `GET /competitors`, `GET /competitors/{id}`, `DELETE /competitors/{id}`.

### Content / calendar / ideas
- `GET /content?status=&q=&platform=&limit=&offset=` -> `{items, total, counts:{all,idea,draft,...}}`; `POST /content`; `GET/PUT/DELETE /content/{id}`; `POST /content/{id}/duplicate`; `POST /content/{id}/schedule` {scheduled_at, platform?}; scheduling also creates/updates a calendar row.
- `GET /calendar?start=&end=`; `POST /calendar`; `PUT /calendar/{id}`; `DELETE /calendar/{id}`; `POST /calendar/{id}/move` {scheduled_at}; `PATCH /calendar/{id}/status` {status}. Calendar status change syncs the linked content status.
- `content` object: `{id, title, topic, content_type, platform, category, language, status, body, caption, hashtags[], notes, ai_generated, scheduled_at, published_at, created_at, updated_at}` (platform/category are slug/name strings in responses; accept slug/name on input).

### Editors / notifications / reports
- `GET /editors?q=&specialization=&language=&limit=` -> `{items:[editor], total}` (only `status=active`); `GET /editors/{id}`
- editor = `{id, display_name, headline, specialization, skills[], languages[], experience_years, portfolio_url, instagram_url, contact_email, avatar_url, bio, is_verified}`
- Editor self-service (role editor): `GET /editors/me/profile`, `PUT /editors/me/profile` (creates row on first save)
- `POST /reports` {target_type, target_id, reason, details?}
- `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`

### Admin (role admin only; any other role => 403)
- `GET /admin/overview` -> `{total_users,total_creators,total_editors,total_content,total_ai_requests,total_categories,reported_profiles (open reports), recent_signups[], ai_requests_by_day[], users_by_role[]}`
- Users: `GET /admin/users?q=&role=&active=`, `PATCH /admin/users/{id}` {is_active?, role? (creator|editor only), full_name?}, `DELETE /admin/users/{id}` (cannot delete self or last admin)
- `GET /admin/creators`, `GET /admin/content?q=`, `DELETE /admin/content/{id}`
- Editors: `GET/POST /admin/editors`, `PUT/DELETE /admin/editors/{id}`, `PATCH /admin/editors/{id}/moderation` {status: active|flagged|suspended, is_verified?}
- Categories: `GET/POST /admin/categories`, `PUT/DELETE /admin/categories/{id}`
- Trends: `GET/POST /admin/trends`, `PUT/DELETE /admin/trends/{id}` (score recomputed server-side from inputs)
- Reports: `GET /admin/reports?status=`, `PATCH /admin/reports/{id}` {status, resolution_note?}
- `GET /admin/ai-usage?days=` -> `{total, by_feature[], by_day[], by_status[], sample_share, avg_latency_ms, top_users[]}`
- `GET /admin/settings`, `PUT /admin/settings` (keys: `open_registration`, `ai_daily_limit_per_user`, `announcement`; stored in `platform_settings`)

## 6. Seed / demo data (`app/database/seed.py`, idempotent)

- 3 languages, 7 platforms, 6 categories, `platform_settings` defaults.
- Demo accounts (README "Demo credentials"; seeded only when `AUTO_SEED`/demo seed runs, never in production seed):
  - Creator: `creator@creatorhub.ai` / `Creator@123` (Marathi preferred, Technology, Instagram, completed profile)
  - Editor: `editor@creatorhub.ai` / `Editor@123`
  - Admin: `admin@creatorhub.ai` / `Admin@12345`
  - ~8 additional creators and ~10 editors (varied specializations/languages) for directory + admin tables.
- 30+ trends across the 6 categories and 3 languages with history, related topics, computed scores; `is_sample=true`, source `CreatorHub sample data`.
- For the demo creator: 90 days of analytics entries across instagram/youtube, ~14 content items across all statuses, 6 calendar rows (past and upcoming), saved ideas/hooks, 4 recommendations, notifications.
- Export script `python -m app.scripts.export_seed_sql > database/seed.sql` produces PostgreSQL-compatible inserts.

## 7. Frontend conventions

Routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`; user app under `/app/...`:
`dashboard, studio, assistant, trends, analyzer, content, calendar, analytics, competitors, long-to-short, editors, profile, profile/setup, settings, editor-profile`; admin under `/admin/...`: `overview, users, creators, editors, categories, trends, content, reports, ai-usage, settings`.
Role redirects after login: creator -> `/app/dashboard` (or `/app/profile/setup` if profile incomplete), editor -> `/app/editor-profile`, admin -> `/admin/overview`.
Editors see a reduced sidebar (Editor Directory, My Editor Profile, Profile, Settings). Admin has a separate layout.

Pages (`frontend/src/pages/`): Landing, Login, Register, ForgotPassword, ResetPassword, Dashboard, ProfileSetup, AIStudio, AIAssistant, Trends, ContentAnalyzer, Content, Calendar, Analytics, CompetitorAnalysis, LongToShort, EditorDirectory, Profile, Settings, EditorProfile, NotFound; `pages/admin/`: AdminOverview, AdminUsers, AdminCreators, AdminEditors, AdminCategories, AdminTrends, AdminContent, AdminReports, AdminAIUsage, AdminSettings.

Cross-page behaviour:
- "Generate Content From This Trend" navigates to `/app/studio?topic=...&category=...&platform=...&language=...`; AI Studio reads these query params.
- Auth token: `localStorage` key `ch_token` when "remember me", otherwise `sessionStorage`. API base from `import.meta.env.VITE_API_URL` (default `/api/v1`, Vite dev proxy to `http://localhost:8000`).
- UI language: `localStorage` `ch_ui_lang` (`en|hi|mr`). i18n via `useI18n().t(key, fallback)`; locale modules live in `src/i18n/locales/*.js` each exporting `{en:{}, hi:{}, mr:{}}` and are merged with `import.meta.glob`. Required translated coverage: shell (sidebar, top bar), auth pages, dashboard, AI Studio, common buttons. Other pages fall back to English.
- AI Assistant history: `localStorage` `ch_chat_<userId>`.

Hard UI rules (see spec sections 2, 34, 51):
- User-visible text must never mention API keys, environment variables, Supabase, OpenAI configuration, databases, deployment, stack traces or server errors. All API errors flow through one `getFriendlyError(err)` helper that returns only the safe `error.message` from section 3 or the generic message.
- Sample data is allowed and labelled with a subtle `Sample` badge or the sentence "Showing available sample insights." — never with technical reasons.
- Every data page has loading (skeleton), empty, error (with Retry) and success (toast) states.
- Every button does something real. No dead links, no "coming soon".
- Responsive: sidebar collapses on tablet, becomes bottom navigation / drawer on mobile; tables degrade to cards; charts use ResponsiveContainer.

Design tokens (CSS variables in `src/styles/tokens.css`, dark-first, light theme optional via `[data-theme=light]`):
- Background `#0a0a0b`, surface `#111113`, surface-2 `#17171a`, border `rgba(255,255,255,.08)`, text `#f4f4f5`, muted `#a1a1aa`.
- Accent: indigo `#6366f1` -> violet `#8b5cf6` used sparingly (focus rings, primary button, small highlights), success `#34d399`, warning `#fbbf24`, danger `#f87171`.
- Font: Inter (Google Fonts with system fallback). Radius 12/16/20. Soft borders, subtle glass (`backdrop-filter: blur`) only on top bar, modals and the landing nav.
- No heavy gradients, no neon glow. Icons: lucide-react only. Brand: wordmark "CreatorHub AI" with a small original spark/hub mark drawn as inline SVG (not any third-party logo).

## 8. Backend layout

```
backend/app/
  main.py                 FastAPI app factory, CORS, exception handlers, routers, startup (init db, validate, seed)
  config/settings.py      Settings + environment validation
  database/               base.py (done), session.py, init_db.py, seed.py
  models/                 (done)
  schemas/                Pydantic request/response models
  routers/                auth, profiles, meta, content, calendar, ideas (hooks/captions/hashtags/scripts/ideas save), editors,
                          notifications, reports, admin, ai, trends, analytics, recommendations, competitors, dashboard, health
  services/               auth_service, security (hash/jwt), rate_limit, content_service, notification_service, youtube_service, competitor_service, recommendation_service, dashboard_service
  ai/                     client.py (OpenAI Responses wrapper), service.py (AIService), prompts.py, sample_generator.py, schemas.py
  analytics/              engagement.py, aggregation.py, analyzer.py
  trends/                 score.py (Trend Score engine), sample_data.py, service.py
  scripts/                create_admin.py, export_seed_sql.py
backend/tests/ -> actually `tests/` at repo root (pytest config in `backend/pytest.ini` sets `testpaths = ../tests`, `pythonpath = .`)
```

## 9. File ownership (to avoid edit collisions)

- Agent BACKEND-CORE: config, errors, database/session|init_db|seed, schemas (core), services (auth, security, rate_limit, lookup, content, notification), routers (health, auth, profiles, meta, content, calendar, ideas, editors, notifications, reports, admin), main.py, scripts, `tests/conftest.py`, tests for auth/rbac/profile/content/calendar/editors/admin/db.
- Agent BACKEND-INTEL: ai/, analytics/, trends/, services (youtube, competitor, recommendation, dashboard), routers (ai, trends, analytics, recommendations, competitors, **dashboard**), related schemas in `schemas/ai.py|trends.py|analytics.py|dashboard.py`, tests for ai/trend score/analytics/engagement/long-to-short/fallback/dashboard. BACKEND-CORE's `main.py` includes these routers (module path `app.routers.<name>` exposing `router`). (Dashboard moved here from CORE because it composes trends, analytics and recommendations.)
- Agent FRONTEND-FOUNDATION: `frontend/` config, `src/styles`, `src/components`, `src/layouts`, `src/services`, `src/hooks`, `src/utils`, `src/i18n`, `App.jsx`, `main.jsx`, shared pieces, placeholder pages that later agents overwrite.
- Later page agents own only their listed page files plus their own `src/i18n/locales/<area>.js`, `src/pages/<area>.css` if needed.
- Agent DB-DOCS: `database/schema.sql`, `database/migrations/`, `docs/`, `README.md`, deploy configs (`vercel.json`, `netlify.toml`, `render.yaml`, `Dockerfile`, `backend/Procfile`, AWS configs), `.env.example`, `.gitignore`.

## 10. Cross-agent interfaces (code against these exact names)

BACKEND-CORE creates these FIRST (before anything else) so BACKEND-INTEL can import them:

- `app/config/settings.py`: `get_settings()` (cached) -> `Settings` with `app_env, debug, database_url, openai_api_key, openai_model,
  youtube_api_key, jwt_secret, jwt_expire_minutes, jwt_remember_expire_minutes, frontend_url, cors_origins(list[str]), auto_seed,
  ai_rate_limit_per_minute, ai_daily_limit_per_user, log_level` and properties `is_production, is_demo, openai_enabled, youtube_enabled`.
- `app/database/session.py`: `engine`, `SessionLocal`, `get_db()` (FastAPI dependency), `session_scope()` context manager,
  `set_rls_context(db, user_id: str | None, role: str)`.
- `app/errors.py`: `AppError(status_code, code, message)` plus `NotFoundError, ForbiddenError, ConflictError, ValidationFailed, RateLimitedError, AIUnavailableError`.
  Handlers registered in `main.py` produce the section-3 error shape.
- `app/routers/deps.py`: `get_current_user` (returns `User`), `require_roles(*roles)`, `CurrentUser = Annotated[User, Depends(get_current_user)]`, `DbSession = Annotated[Session, Depends(get_db)]`.
- `app/services/rate_limit.py`: `ai_rate_limit` FastAPI dependency (per-minute + per-day per user; raises `RateLimitedError`).
- `app/services/lookup.py`: `platform_id(db, slug_or_name)`, `category_id(db, slug_or_name)`, `platform_slug(db, id)`, `category_name(db, id)`, `language_code(value)`.
- `tests/conftest.py` fixtures: `db` (in-memory SQLite, seeded), `client` (FastAPI TestClient, `OPENAI_API_KEY` unset so sample mode),
  `creator_headers`, `editor_headers`, `admin_headers` (bearer headers for the demo accounts), `make_user(role)`.

BACKEND-INTEL provides (CORE's `seed.py` calls them via guarded imports until all agents are done):

- `app.trends.service.seed_sample_trends(db) -> int` (idempotent; builds >= 30 trends, computes scores with `app.trends.score.compute_trend_score`)
- `app.analytics.sample_data.seed_demo_analytics(db, user_id, days=90) -> int`
- `app.services.recommendation_service.seed_demo_recommendations(db, user_id) -> int`
- `app.analytics.engagement.compute_engagement(likes, comments, shares, saves, reach, views) -> {"rate": float, "basis": "reach"|"views", "formula": str, "label": str}`
- `app.trends.score.compute_trend_score(recency_days, growth_pct, engagement_rate, topic_frequency, *, bounds=None) -> {"score": float, "breakdown": {"recency","growth","engagement","frequency"}}`
- `app.ai.service.AIService` (single reusable service; all AI routes go through it)

Row Level Security design (our auth is our own JWT, not Supabase Auth, so policies use session settings, not `auth.uid()`):

- `schema.sql` enables RLS on every user-owned table with policies of the form
  `user_id = nullif(current_setting('app.current_user_id', true), '')::uuid OR current_setting('app.current_role', true) IN ('admin','system')`.
  Public reference/trend/editor tables allow SELECT to everyone and write only for role `admin`/`system`.
- On PostgreSQL, `get_current_user` calls `set_rls_context(db, user_id, role)` (`SELECT set_config('app.current_user_id', :uid, true)` and `app.current_role`),
  and register/login/reset/seed flows use role `system`. On SQLite `set_rls_context` is a no-op.
- RLS only binds roles WITHOUT `BYPASSRLS`. Docs must instruct creating a non-bypass application role and using its connection string
  (Supabase's default `postgres` role bypasses RLS). Application-level authorization remains the primary control; RLS is defense in depth.
