P = "/api/v1"


def _mk(client, h, **over):
    body = {"title": "My reel", "topic": "AI", "content_type": "reel", "platform": "instagram", "category": "Technology",
            "language": "en", "hashtags": ["#a", "b"]}
    body.update(over)
    r = client.post(f"{P}/content", headers=h, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_content_crud(client, creator_headers):
    c = _mk(client, creator_headers)
    assert c["platform"] == "instagram" and c["category"] == "Technology" and c["status"] == "draft"
    got = client.get(f"{P}/content/{c['id']}", headers=creator_headers).json()
    assert got["title"] == "My reel"
    up = client.put(f"{P}/content/{c['id']}", headers=creator_headers, json={"title": "Renamed", "status": "script"})
    assert up.status_code == 200 and up.json()["title"] == "Renamed" and up.json()["status"] == "script"
    lst = client.get(f"{P}/content?status=script&q=renamed", headers=creator_headers).json()
    assert lst["total"] == 1 and "counts" in lst and lst["counts"]["script"] == 1
    assert client.get(f"{P}/content", headers=creator_headers).json()["counts"]["all"] >= 14
    assert client.delete(f"{P}/content/{c['id']}", headers=creator_headers).status_code == 200
    assert client.get(f"{P}/content/{c['id']}", headers=creator_headers).status_code == 404


def test_content_validation(client, creator_headers):
    assert client.post(f"{P}/content", headers=creator_headers, json={"title": "   "}).status_code == 422
    assert client.post(f"{P}/content", headers=creator_headers, json={"title": "x", "status": "bogus"}).status_code == 422
    assert client.post(f"{P}/content", headers=creator_headers, json={"title": "x" * 300}).status_code == 422


def test_duplicate(client, creator_headers):
    c = _mk(client, creator_headers, title="Original")
    d = client.post(f"{P}/content/{c['id']}/duplicate", headers=creator_headers)
    assert d.status_code == 201
    j = d.json()
    assert j["id"] != c["id"] and j["status"] == "draft" and "Original" in j["title"]


def test_schedule_creates_calendar_row(client, creator_headers):
    c = _mk(client, creator_headers)
    r = client.post(f"{P}/content/{c['id']}/schedule", headers=creator_headers,
                    json={"scheduled_at": "2030-01-05T10:00:00Z", "platform": "youtube"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "scheduled" and r.json()["scheduled_at"].startswith("2030-01-05T10:00:00")
    cal = client.get(f"{P}/calendar?start=2030-01-01&end=2030-01-31", headers=creator_headers).json()
    items = [i for i in cal["items"] if i.get("content_id") == c["id"]]
    assert len(items) == 1 and items[0]["status"] == "scheduled"


def test_calendar_create_move_status_sync(client, creator_headers):
    c = _mk(client, creator_headers)
    r = client.post(f"{P}/calendar", headers=creator_headers,
                    json={"content_id": c["id"], "scheduled_at": "2030-02-01T09:00:00Z", "status": "scheduled"})
    assert r.status_code == 201, r.text
    e = r.json()
    mv = client.post(f"{P}/calendar/{e['id']}/move", headers=creator_headers, json={"scheduled_at": "2030-02-03T09:00:00Z"})
    assert mv.status_code == 200 and mv.json()["scheduled_at"].startswith("2030-02-03")
    assert client.get(f"{P}/content/{c['id']}", headers=creator_headers).json()["scheduled_at"].startswith("2030-02-03")
    st = client.patch(f"{P}/calendar/{e['id']}/status", headers=creator_headers, json={"status": "published"})
    assert st.status_code == 200 and st.json()["status"] == "published"
    assert client.get(f"{P}/content/{c['id']}", headers=creator_headers).json()["status"] == "published"
    assert client.delete(f"{P}/calendar/{e['id']}", headers=creator_headers).status_code == 200
    assert client.patch(f"{P}/calendar/{e['id']}/status", headers=creator_headers, json={"status": "draft"}).status_code == 404


def test_calendar_standalone_entry(client, creator_headers):
    r = client.post(f"{P}/calendar", headers=creator_headers,
                    json={"title": "Plan shoot", "scheduled_at": "2030-03-01T09:00:00Z", "status": "idea"})
    assert r.status_code == 201 and r.json()["title"] == "Plan shoot"
    up = client.put(f"{P}/calendar/{r.json()['id']}", headers=creator_headers, json={"title": "Plan shoot v2"})
    assert up.json()["title"] == "Plan shoot v2"


def test_isolation_content_and_calendar(client, creator_headers, make_user):
    other = make_user("creator")
    c = _mk(client, creator_headers)
    cal = client.post(f"{P}/calendar", headers=creator_headers,
                      json={"title": "mine", "scheduled_at": "2030-04-01T09:00:00Z"}).json()
    h = other.headers
    assert client.get(f"{P}/content/{c['id']}", headers=h).status_code == 404
    assert client.put(f"{P}/content/{c['id']}", headers=h, json={"title": "hax"}).status_code == 404
    assert client.delete(f"{P}/content/{c['id']}", headers=h).status_code == 404
    assert client.post(f"{P}/content/{c['id']}/duplicate", headers=h).status_code == 404
    assert client.post(f"{P}/content/{c['id']}/schedule", headers=h, json={"scheduled_at": "2030-01-01T00:00:00Z"}).status_code == 404
    assert client.put(f"{P}/calendar/{cal['id']}", headers=h, json={"title": "hax"}).status_code == 404
    assert client.delete(f"{P}/calendar/{cal['id']}", headers=h).status_code == 404
    assert client.post(f"{P}/calendar/{cal['id']}/move", headers=h, json={"scheduled_at": "2030-01-01T00:00:00Z"}).status_code == 404
    assert client.get(f"{P}/content", headers=h).json()["total"] == 0
    # still intact for the owner
    assert client.get(f"{P}/content/{c['id']}", headers=creator_headers).json()["title"] == "My reel"


def test_saved_items_and_script_to_content(client, creator_headers, make_user):
    h = creator_headers
    idea = client.post(f"{P}/ideas", headers=h, json={"title": "Idea A", "topic": "t", "suggested_hook": "hook"})
    assert idea.status_code == 201
    hook = client.post(f"{P}/hooks", headers=h, json={"hook_type": "question", "text": "Why?", "topic": "t"})
    assert hook.status_code == 201, hook.text
    s = client.post(f"{P}/scripts", headers=h, json={"topic": "t", "hook": "h", "full_script": "full text",
                                                      "main_points": ["a"], "language": "en"})
    assert s.status_code == 201, s.text
    sc = client.post(f"{P}/scripts/{s.json()['id']}/save-to-content", headers=h, json={})
    assert sc.status_code == 201 and sc.json()["status"] == "script"
    other = make_user("creator")
    assert client.delete(f"{P}/ideas/{idea.json()['id']}", headers=other.headers).status_code == 404
    assert client.delete(f"{P}/ideas/{idea.json()['id']}", headers=h).status_code == 200
    assert client.get(f"{P}/hooks", headers=h).json()["total"] >= 1
    assert client.get(f"{P}/hooks", headers=other.headers).json()["total"] == 0
