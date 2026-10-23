P = "/api/v1"


def test_creator_cannot_use_admin(client, creator_headers, editor_headers):
    for h in (creator_headers, editor_headers):
        r = client.get(f"{P}/admin/overview", headers=h)
        assert r.status_code == 403 and r.json()["error"]["code"] == "FORBIDDEN"


def test_admin_unauth_and_ok(client, admin_headers):
    assert client.get(f"{P}/admin/overview").status_code == 401
    r = client.get(f"{P}/admin/overview", headers=admin_headers)
    assert r.status_code == 200 and r.json()["total_users"] >= 3


def test_editor_routes_role_checked(client, creator_headers, editor_headers):
    assert client.get(f"{P}/editors/me/profile", headers=creator_headers).status_code == 403
    assert client.get(f"{P}/editors/me/profile", headers=editor_headers).status_code == 200


def test_meta_public(client):
    j = client.get(f"{P}/meta").json()
    assert len(j["categories"]) >= 6 and len(j["languages"]) == 3 and len(j["platforms"]) == 7
    assert "draft" in j["statuses"]


def test_profile_update_marks_completed(client, make_user):
    u = make_user("creator")
    assert client.get(f"{P}/profiles/me", headers=u.headers).json()["profile"]["profile_completed"] is False
    r = client.put(f"{P}/profiles/me", headers=u.headers, json={
        "full_name": "Updated Name", "username": "updated_name1", "preferred_language": "mr", "category": "technology",
        "platform": "instagram", "creator_type": "solo", "experience_level": "beginner", "interests": ["ai", "coding"],
        "default_tone": "casual"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["full_name"] == "Updated Name" and j["profile"]["profile_completed"] is True
    assert j["profile"]["preferred_language"] == "mr" and j["creator_profile"]["interests"] == ["ai", "coding"]
    assert client.get(f"{P}/auth/me", headers=u.headers).json()["profile"]["profile_completed"] is True


def test_profile_validation(client, creator_headers):
    r = client.put(f"{P}/profiles/me", headers=creator_headers, json={"preferred_language": "xx"})
    assert r.status_code == 422
    r = client.put(f"{P}/profiles/me", headers=creator_headers, json={"bio": "x" * 5000})
    assert r.status_code == 422


def test_demo_creator_profile(client, creator_headers):
    j = client.get(f"{P}/auth/me", headers=creator_headers).json()
    assert j["profile"]["preferred_language"] == "mr" and j["profile"]["profile_completed"] is True


def test_health_ready(client):
    assert client.get("/health").json() == {"status": "ok"}
    r = client.get("/ready")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
