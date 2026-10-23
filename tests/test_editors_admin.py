P = "/api/v1"


def test_editor_directory_filters(client, creator_headers):
    all_ = client.get(f"{P}/editors", headers=creator_headers).json()
    assert all_["total"] >= 11
    reels = client.get(f"{P}/editors?specialization=reels", headers=creator_headers).json()
    assert reels["total"] >= 2 and all(e["specialization"] == "reels" for e in reels["items"])
    mr = client.get(f"{P}/editors?language=mr", headers=creator_headers).json()
    assert mr["total"] >= 3 and all("mr" in e["languages"] for e in mr["items"])
    q = client.get(f"{P}/editors?q=after effects", headers=creator_headers).json()
    assert q["total"] >= 1 and any("After Effects" in e["skills"] for e in q["items"])
    one = client.get(f"{P}/editors/{all_['items'][0]['id']}", headers=creator_headers)
    assert one.status_code == 200 and "skills" in one.json()
    assert client.get(f"{P}/editors/not-a-uuid", headers=creator_headers).status_code == 404
    assert client.get(f"{P}/editors").status_code == 401


def test_editor_self_profile_create(client, make_user):
    u = make_user("editor")
    assert client.get(f"{P}/editors/me/profile", headers=u.headers).status_code == 404
    r = client.put(f"{P}/editors/me/profile", headers=u.headers, json={
        "display_name": "Fresh Editor", "specialization": "youtube", "skills": ["Premiere Pro", "premiere pro", "Audio"],
        "languages": ["en"], "experience_years": 2, "contact_email": "fresh@example.com"})
    assert r.status_code == 200, r.text
    assert sorted(r.json()["skills"]) == ["Audio", "Premiere Pro"]
    assert client.get(f"{P}/editors/me/profile", headers=u.headers).json()["display_name"] == "Fresh Editor"
    bad = client.put(f"{P}/editors/me/profile", headers=u.headers, json={"display_name": "x", "specialization": "nope"})
    assert bad.status_code == 422


def test_admin_categories_crud(client, admin_headers, creator_headers):
    r = client.post(f"{P}/admin/categories", headers=admin_headers, json={"name": "Travel", "description": "Trips"})
    assert r.status_code == 201 and r.json()["slug"] == "travel"
    cid = r.json()["id"]
    assert client.post(f"{P}/admin/categories", headers=admin_headers, json={"name": "travel"}).status_code == 409
    up = client.put(f"{P}/admin/categories/{cid}", headers=admin_headers, json={"name": "Travel Vlogs", "is_active": False})
    assert up.json()["slug"] == "travel_vlogs" and up.json()["is_active"] is False
    names = [c["name"] for c in client.get(f"{P}/meta").json()["categories"]]
    assert "Travel Vlogs" not in names
    assert client.post(f"{P}/admin/categories", headers=creator_headers, json={"name": "Nope"}).status_code == 403
    assert client.delete(f"{P}/admin/categories/{cid}", headers=admin_headers).status_code == 200
    assert client.delete(f"{P}/admin/categories/{cid}", headers=admin_headers).status_code == 404


def test_admin_editors_crud_and_moderation(client, admin_headers, creator_headers):
    r = client.post(f"{P}/admin/editors", headers=admin_headers, json={
        "display_name": "Admin Added", "specialization": "thumbnail", "skills": ["Photoshop"], "languages": ["hi"]})
    assert r.status_code == 201, r.text
    eid = r.json()["id"]
    assert client.put(f"{P}/admin/editors/{eid}", headers=admin_headers, json={"headline": "Hi", "skills": ["Figma"]}).json()["skills"] == ["Figma"]
    mod = client.patch(f"{P}/admin/editors/{eid}/moderation", headers=admin_headers, json={"status": "suspended", "is_verified": True})
    assert mod.json()["status"] == "suspended" and mod.json()["is_verified"] is True
    names = [e["display_name"] for e in client.get(f"{P}/editors?limit=200", headers=creator_headers).json()["items"]]
    assert "Admin Added" not in names
    assert client.get(f"{P}/admin/editors?status=suspended", headers=admin_headers).json()["total"] == 1
    assert client.patch(f"{P}/admin/editors/{eid}/moderation", headers=admin_headers, json={"status": "weird"}).status_code == 422
    assert client.delete(f"{P}/admin/editors/{eid}", headers=admin_headers).status_code == 200
    assert client.get(f"{P}/admin/editors", headers=creator_headers).status_code == 403


def test_admin_users(client, admin_headers, make_user):
    u = make_user("creator")
    lst = client.get(f"{P}/admin/users?role=creator&q={u.email[:8]}", headers=admin_headers).json()
    assert lst["total"] >= 1
    r = client.patch(f"{P}/admin/users/{u.id}", headers=admin_headers, json={"is_active": False})
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert client.get(f"{P}/auth/me", headers=u.headers).status_code == 401  # deactivated -> token unusable
    login = client.post(f"{P}/auth/login", json={"email": u.email, "password": u.password})
    assert login.status_code == 401
    assert client.patch(f"{P}/admin/users/{u.id}", headers=admin_headers, json={"role": "admin"}).status_code == 422
    assert client.patch(f"{P}/admin/users/{u.id}", headers=admin_headers, json={"role": "editor"}).json()["role"] == "editor"
    assert client.delete(f"{P}/admin/users/{u.id}", headers=admin_headers).status_code == 200
    assert client.delete(f"{P}/admin/users/{u.id}", headers=admin_headers).status_code == 404


def test_admin_cannot_delete_or_deactivate_self(client, admin_headers):
    me = client.get(f"{P}/auth/me", headers=admin_headers).json()
    assert client.delete(f"{P}/admin/users/{me['id']}", headers=admin_headers).status_code == 422
    assert client.patch(f"{P}/admin/users/{me['id']}", headers=admin_headers, json={"is_active": False}).status_code == 422


def test_admin_content_creators_listing(client, admin_headers, creator_headers):
    assert client.get(f"{P}/admin/creators", headers=admin_headers).json()["total"] >= 9
    lst = client.get(f"{P}/admin/content?q=python", headers=admin_headers).json()
    assert lst["total"] >= 1
    cid = lst["items"][0]["id"]
    assert client.delete(f"{P}/admin/content/{cid}", headers=admin_headers).status_code == 200
    assert client.get(f"{P}/content/{cid}", headers=creator_headers).status_code == 404


def test_admin_trends_crud_recomputes_score(client, admin_headers):
    body = {"topic": "Edge AI gadgets", "category": "technology", "platform": "youtube", "language": "en",
            "recency_days": 1, "growth_pct": 150, "engagement_rate": 8, "topic_frequency": 100,
            "related_topics": ["ai", "gadgets"], "trend_score": 1}
    r = client.post(f"{P}/admin/trends", headers=admin_headers, json=body)
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["trend_score"] > 30 and t["trend_score"] != 1 and set(t["score_breakdown"]) == {"recency", "growth", "engagement", "frequency"}
    up = client.put(f"{P}/admin/trends/{t['id']}", headers=admin_headers, json={"growth_pct": 300, "engagement_rate": 15})
    assert up.json()["trend_score"] > t["trend_score"]
    assert client.delete(f"{P}/admin/trends/{t['id']}", headers=admin_headers).status_code == 200
    assert client.put(f"{P}/admin/trends/{t['id']}", headers=admin_headers, json={"growth_pct": 1}).status_code == 404


def test_admin_settings_and_registration_toggle(client, admin_headers):
    assert client.get(f"{P}/admin/settings", headers=admin_headers).json()["open_registration"] is True
    r = client.put(f"{P}/admin/settings", headers=admin_headers,
                   json={"open_registration": False, "announcement": "Maintenance tonight"})
    assert r.json()["open_registration"] is False and r.json()["announcement"] == "Maintenance tonight"
    blocked = client.post(f"{P}/auth/register", json={"full_name": "A B", "email": "a.b@example.com", "password": "Strong@123", "role": "creator"})
    assert blocked.status_code == 403


def test_admin_ai_usage_computed(client, admin_headers, db):
    from app.models.system import AIRequest
    from app.models.user import User
    from sqlalchemy import select
    uid = db.scalar(select(User.id).where(User.email == "creator@creatorhub.ai"))
    for status, feat in (("sample", "hooks"), ("sample", "script"), ("success", "hooks")):
        db.add(AIRequest(user_id=uid, feature=feat, status=status, latency_ms=100, input_chars=5, output_chars=9))
    db.commit()
    j = client.get(f"{P}/admin/ai-usage?days=7", headers=admin_headers).json()
    assert j["total"] == 3 and j["sample_share"] == 0.667 and j["avg_latency_ms"] == 100.0
    assert {f["feature"]: f["count"] for f in j["by_feature"]} == {"hooks": 2, "script": 1}
    assert j["top_users"][0]["count"] == 3 and len(j["by_day"]) == 1
    ov = client.get(f"{P}/admin/overview", headers=admin_headers).json()
    assert ov["total_ai_requests"] == 3 and ov["reported_profiles"] >= 1
