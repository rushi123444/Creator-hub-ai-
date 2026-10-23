from sqlalchemy import select

P = "/api/v1"


def test_notifications_flow(client, creator_headers, make_user):
    lst = client.get(f"{P}/notifications", headers=creator_headers).json()
    assert lst["total"] >= 4
    unread = [n for n in lst["items"] if not n["is_read"]]
    assert unread
    nid = unread[0]["id"]
    assert client.post(f"{P}/notifications/{nid}/read", headers=creator_headers).status_code == 200
    other = make_user("creator")
    assert client.post(f"{P}/notifications/{nid}/read", headers=other.headers).status_code == 404
    assert client.post(f"{P}/notifications/read-all", headers=creator_headers).status_code == 200
    after = client.get(f"{P}/notifications", headers=creator_headers).json()
    assert all(n["is_read"] for n in after["items"])
    assert client.get(f"{P}/notifications", headers=other.headers).json()["total"] == 0


def test_registration_creates_welcome_notification(client):
    r = client.post(f"{P}/auth/register", json={"full_name": "Wel Come", "email": "wel@example.com", "password": "Strong@123", "role": "editor"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    items = client.get(f"{P}/notifications", headers=h).json()["items"]
    assert len(items) == 1 and items[0]["kind"] == "welcome"


def test_reports(client, creator_headers, admin_headers, db):
    from app.models.user import EditorProfile
    eid = str(db.scalar(select(EditorProfile.id).limit(1)))
    r = client.post(f"{P}/reports", headers=creator_headers,
                    json={"target_type": "editor_profile", "target_id": eid, "reason": "Spam", "details": "Looks fake"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    missing = client.post(f"{P}/reports", headers=creator_headers,
                          json={"target_type": "editor_profile", "target_id": "00000000-0000-0000-0000-000000000000", "reason": "Spam"})
    assert missing.status_code == 404
    assert client.post(f"{P}/reports", headers=creator_headers, json={"target_type": "bogus", "target_id": eid, "reason": "Spam"}).status_code == 422
    assert client.get(f"{P}/admin/reports?status=open", headers=admin_headers).json()["total"] >= 2
    up = client.patch(f"{P}/admin/reports/{rid}", headers=admin_headers, json={"status": "resolved", "resolution_note": "Checked"})
    assert up.status_code == 200 and up.json()["status"] == "resolved"
    assert client.patch(f"{P}/admin/reports/{rid}", headers=creator_headers, json={"status": "resolved"}).status_code == 403


def test_seed_is_idempotent(db):
    from app.database.seed import seed_all
    from app.models.content import Content
    from app.models.user import EditorProfile, User
    from sqlalchemy import func
    counts = lambda: tuple(db.scalar(select(func.count()).select_from(m)) for m in (User, Content, EditorProfile))
    before = counts()
    seed_all(db, include_demo_accounts=True)
    assert counts() == before
    assert before[0] >= 11 and before[1] >= 14 and before[2] >= 11


def test_production_seed_has_no_demo_accounts():
    from sqlalchemy.orm import Session
    from app.database.base import Base
    from app.database.seed import seed_all
    from app.database.session import make_engine
    from app.models.user import User
    eng = make_engine("sqlite://")
    Base.metadata.create_all(eng)
    with Session(eng) as s:
        seed_all(s, include_demo_accounts=False)
        assert s.scalar(select(User.id)) is None


def test_production_config_validation(monkeypatch):
    import pytest
    from app.config.settings import ConfigurationError, Settings
    bad = Settings(app_env="production", jwt_secret="short", database_url=None)
    assert len(bad.production_problems()) >= 2
    with pytest.raises(ConfigurationError):
        bad.validate_startup()
    good = Settings(app_env="production", jwt_secret="x" * 40, database_url="postgresql://u:p@h/db",
                    frontend_url="https://app.example.com")
    assert good.production_problems() == [] and "*" not in good.cors_origins and good.auto_seed is False
    assert Settings(app_env="production", jwt_secret="x" * 40, database_url="sqlite://", CORS_ORIGINS="*").production_problems()


def test_unhandled_error_is_generic(app, client, creator_headers):
    from fastapi import APIRouter
    r = APIRouter()

    @r.get("/boom")
    def boom():
        raise RuntimeError("secret internal detail postgres://user:pw@host")

    app.include_router(r)
    res = client.get("/boom")
    assert res.status_code == 500
    assert res.json() == {"error": {"code": "SERVER_ERROR", "message": "Something went wrong. Please try again."}}
