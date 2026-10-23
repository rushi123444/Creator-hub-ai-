from app.services.security import denylist

P = "/api/v1"


def _reg(client, **over):
    body = {"full_name": "New Person", "email": "new.person@example.com", "password": "Strong@123", "role": "creator"}
    body.update(over)
    return client.post(f"{P}/auth/register", json=body)


def test_register_ok(client):
    r = _reg(client)
    assert r.status_code == 201
    j = r.json()
    assert j["access_token"] and j["user"]["role"] == "creator" and j["user"]["profile"]["profile_completed"] is False
    assert "password" not in str(j).lower().replace("password_hash", "x") or "password_hash" not in j["user"]


def test_register_admin_rejected(client):
    r = _reg(client, role="admin")
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_register_duplicate(client):
    assert _reg(client).status_code == 201
    r = _reg(client, email="NEW.person@example.com")
    assert r.status_code == 409 and r.json()["error"]["code"] == "CONFLICT"


def test_register_weak_password(client):
    assert _reg(client, password="short").status_code == 422
    assert _reg(client, password="allletters").status_code == 422


def test_login_good_and_bad(client):
    ok = client.post(f"{P}/auth/login", json={"email": "creator@creatorhub.ai", "password": "Creator@123"})
    assert ok.status_code == 200 and ok.json()["user"]["role"] == "creator"
    bad = client.post(f"{P}/auth/login", json={"email": "creator@creatorhub.ai", "password": "nope"})
    assert bad.status_code == 401 and bad.json()["error"]["message"] == "Incorrect email or password."
    unknown = client.post(f"{P}/auth/login", json={"email": "ghost@example.com", "password": "nope"})
    assert unknown.json() == bad.json()


def test_login_rate_limit(client):
    codes = [client.post(f"{P}/auth/login", json={"email": "x@example.com", "password": "bad"}).status_code
             for _ in range(12)]
    assert codes[:10] == [401] * 10 and codes[-1] == 429


def test_logout_revokes_token(client):
    token = client.post(f"{P}/auth/login", json={"email": "creator@creatorhub.ai", "password": "Creator@123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    assert client.get(f"{P}/auth/me", headers=h).status_code == 200
    assert client.post(f"{P}/auth/logout", headers=h).json() == {"ok": True}
    assert client.get(f"{P}/auth/me", headers=h).status_code == 401
    denylist.clear()


def test_me_requires_auth(client):
    r = client.get(f"{P}/auth/me")
    assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHORIZED"
    assert client.get(f"{P}/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_forgot_password_no_enumeration(client):
    a = client.post(f"{P}/auth/forgot-password", json={"email": "creator@creatorhub.ai"})
    b = client.post(f"{P}/auth/forgot-password", json={"email": "nobody@example.com"})
    assert a.status_code == b.status_code == 200 and a.json() == b.json() == {"ok": True}


def test_reset_password_flow(client, db):
    from app.models.user import User
    from app.services import security
    from sqlalchemy import select
    u = db.scalar(select(User).where(User.email == "creator@creatorhub.ai"))
    token = security.create_reset_token(str(u.id), u.password_hash)
    r = client.post(f"{P}/auth/reset-password", json={"token": token, "new_password": "Brand@New99"})
    assert r.status_code == 200
    assert client.post(f"{P}/auth/login", json={"email": "creator@creatorhub.ai", "password": "Brand@New99"}).status_code == 200
    again = client.post(f"{P}/auth/reset-password", json={"token": token, "new_password": "Another@123"})
    assert again.status_code == 422
    assert client.post(f"{P}/auth/reset-password", json={"token": "x" * 20, "new_password": "Another@123"}).status_code == 422


def test_error_shape_and_headers(client):
    r = client.get(f"{P}/nope")
    assert r.status_code == 404 and set(r.json()["error"]) >= {"code", "message"}
    assert r.headers["x-content-type-options"] == "nosniff"
