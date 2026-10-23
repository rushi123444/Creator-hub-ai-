# Testing

Backend tests use pytest with an in-memory SQLite database (seeded) and the FastAPI TestClient. `OPENAI_API_KEY` is unset in tests, so AI runs in sample mode. Config: `backend/pytest.ini` (`testpaths = ../tests`).

```bash
cd backend
pip install -r requirements.txt
python -m pytest ../tests -q        # 109 tests, about 10 s
```

Last local run: `109 passed`.

| File | Covers |
|---|---|
| `tests/test_auth.py`, `test_rbac_profile.py` | register/login/logout, role rules, profile |
| `tests/test_content_calendar.py` | content CRUD, scheduling, calendar sync |
| `tests/test_editors_admin.py` | editor directory, admin routes |
| `tests/test_notifications_reports_db.py` | notifications, reports, DB behaviour |
| `tests/test_ai_sample.py`, `test_fallback.py` | sample generator, AI fallback |
| `tests/test_trend_score.py`, `test_trends_api.py` | Trend Score, trends API |
| `tests/test_engagement.py`, `test_analytics.py` | engagement formula, analytics |
| `tests/test_competitors.py`, `test_dashboard.py` | competitor analysis, dashboard |

Fixtures (`tests/conftest.py`): `db`, `client`, `creator_headers`, `editor_headers`, `admin_headers`, `make_user`.

## Not covered by automated tests

- PostgreSQL and RLS policies: tests run on SQLite where `set_rls_context` is a no-op. `database/tests/` is empty; verify `schema.sql` and RLS on your own PostgreSQL before relying on them.
- Real OpenAI and YouTube calls (need keys and may incur charges).
- Frontend: no automated tests; check with `cd frontend && npm run build` and the manual flow in [MSBTE_DEMO_GUIDE.md](MSBTE_DEMO_GUIDE.md).

## Manual smoke test

```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"creator@creatorhub.ai","password":"Creator@123"}'
```
