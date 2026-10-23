# CreatorHub AI - API Reference (condensed)

Full contract: [CONTRACT.md](CONTRACT.md). Base URL `http://localhost:8000/api/v1` (interactive FastAPI docs, if enabled for your environment, are at `/docs`). JSON only; auth via `Authorization: Bearer <token>` unless marked public.

## Conventions

- Success: the resource, or `{ "items": [...], "total": n }` for lists. No envelope.
- Errors: `{ "error": { "code": "UPPER_SNAKE", "message": "friendly text" } }`.

| Code | HTTP |
|---|---|
| UNAUTHORIZED | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND | 404 |
| CONFLICT | 409 |
| VALIDATION_ERROR | 422 (optional `fields`) |
| RATE_LIMITED | 429 |
| AI_UNAVAILABLE | 503 |
| SERVER_ERROR | 500 |

- Timestamps ISO-8601 UTC; dates `YYYY-MM-DD`; languages `en|hi|mr`; platform/category accepted as slug or name.

## System (no `/api/v1` prefix)

`GET /health` (liveness), `GET /ready` (DB check, returns only `{status}`). Both public.

## Auth, profile, meta

| Method + path | Body / notes |
|---|---|
| `POST /auth/register` | `{full_name, email, password (min 8), role: creator|editor}`; `admin` => 422. Returns `{access_token, token_type, user}` |
| `POST /auth/login` | `{email, password, remember_me?}`; 10 attempts/min/IP |
| `POST /auth/logout` | revokes token `jti`; `{ok:true}` |
| `POST /auth/forgot-password` | public; always `{ok:true}`; no email is sent (not implemented) |
| `POST /auth/reset-password` | public; `{token, new_password}` |
| `GET /auth/me` | user object with `profile` and `creator_profile` |
| `GET/PUT /profiles/me` | profile + creator_profile fields + `full_name` |
| `GET /meta` | public; categories, languages, platforms, content_types, tones, statuses |

## AI (rate limited; responses carry `is_sample` and `model`)

`POST /ai/generate`, `/ai/hooks`, `/ai/script`, `/ai/caption`, `/ai/hashtags`, `/ai/ideas`, `/ai/regenerate` (`{section, hook_type?, params, current?}`), `/ai/assistant` (`{messages, language?}`; stateless), `/ai/long-to-short` (`source_text` min 80 chars; 3 shorts), `/ai/summarize`, `/ai/classify-topic`.
Common request fields: `topic, language, platform, category, audience, tone, duration_seconds, content_type, instructions`. No key => sample content (`is_sample:true`); provider failure => 503 `AI_UNAVAILABLE`.
Saved output: `GET/POST /hooks|captions|hashtags|scripts|ideas`, `DELETE /{kind}/{id}`, `POST /scripts/{id}/save-to-content`.

## Trends

`GET /trends?platform=&category=&language=&days=&q=&sort=score|growth|engagement&limit=` returns `{items, charts{growth,frequency,categories}, source: live|sample, note, score_definition}`. `GET /trends/{id}`. `POST /trends/refresh` always 200 `{source, updated}`.

## Analytics, analyzer, recommendations, dashboard

| Endpoint | Notes |
|---|---|
| `GET /analytics/summary?start=&end=&platform=&category=&language=` | totals, engagement (`rate, basis, formula, label`), series, breakdowns, `has_data` |
| `GET/POST /analytics/entries`, `PUT/DELETE /analytics/entries/{id}` | list returns `{items,total}`; **DELETE returns `{ok:true}`** (verified in `routers/analytics.py`) |
| `POST /analytics/analyze` | analytical observations plus a disclaimer; never promises virality |
| `GET /recommendations` | **returns `{items, total}`** |
| `POST /recommendations/generate` | **returns `{items, total}`**; rule-based, AI-worded when available |
| `POST /recommendations/{id}/dismiss` | |
| `GET /dashboard` | `{greeting_name, stats, trending, recent_content, upcoming, recommendations, charts, is_sample_data}` |

## Competitors (public information only)

`POST /competitors/analyze {platform, handle_or_url}`, `GET /competitors`, `GET /competitors/{id}`, `DELETE /competitors/{id}`. Uses the YouTube Data API for YouTube when `YOUTUBE_API_KEY` is set, otherwise labelled sample data.

## Content and calendar

`GET /content?status=&q=&platform=&limit=&offset=` returns `{items,total,counts}`; `POST /content`; `GET/PUT/DELETE /content/{id}`; `POST /content/{id}/duplicate`; `POST /content/{id}/schedule {scheduled_at, platform?}`.
`GET /calendar?start=&end=`; `POST /calendar`; `PUT/DELETE /calendar/{id}`; `POST /calendar/{id}/move {scheduled_at}`; `PATCH /calendar/{id}/status {status}` (syncs linked content status).

## Editors, notifications, reports

`GET /editors?q=&specialization=&language=&limit=` (active only), `GET /editors/{id}`, `GET/PUT /editors/me/profile` (editor role). `POST /reports {target_type, target_id, reason, details?}`. `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.

## Admin (role `admin`; others get 403)

`GET /admin/overview`; users `GET /admin/users`, `PATCH|DELETE /admin/users/{id}` (not self or last admin); `GET /admin/creators`; `GET /admin/content`, `DELETE /admin/content/{id}`; editors `GET|POST /admin/editors`, `PUT|DELETE /admin/editors/{id}`, `PATCH /admin/editors/{id}/moderation`; categories `GET|POST /admin/categories`, `PUT|DELETE /admin/categories/{id}`; trends `GET|POST /admin/trends`, `PUT|DELETE /admin/trends/{id}` (score recomputed server-side); reports `GET /admin/reports`, `PATCH /admin/reports/{id}`; `GET /admin/ai-usage?days=`; `GET|PUT /admin/settings`.
