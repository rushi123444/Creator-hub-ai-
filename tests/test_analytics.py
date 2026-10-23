"""Analytics summary, filters, entries CRUD, user isolation, analyzer, recommendations."""
from app.analytics.analyzer import DISCLAIMER, analyze

A = "/api/v1/analytics"
FORBIDDEN_PHRASES = ("will go viral", "guaranteed", "guarantee virality", "will definitely", "100% sure")


def test_summary_shape_for_demo_creator(client, creator_headers):
    d = client.get(f"{A}/summary", headers=creator_headers).json()
    assert d["has_data"] is True
    assert set(d["totals"]) == {"views", "likes", "comments", "shares", "saves", "reach", "watch_time_minutes", "followers_gained"}
    assert d["engagement"]["basis"] in ("reach", "views") and d["engagement"]["formula"]
    assert d["series"]["views"] and d["by_platform"] and d["by_category"] and d["by_language"] and d["by_content"]


def test_date_and_platform_filters(client, creator_headers):
    full = client.get(f"{A}/summary", headers=creator_headers).json()
    from datetime import date, timedelta
    start = (date.today() - timedelta(days=14)).isoformat()
    part = client.get(f"{A}/summary", params={"start": start}, headers=creator_headers).json()
    assert 0 < part["totals"]["views"] < full["totals"]["views"]
    assert all(p["date"] >= start for p in part["series"]["views"])
    yt = client.get(f"{A}/summary", params={"platform": "youtube"}, headers=creator_headers).json()
    assert [p["platform"] for p in yt["by_platform"]] == ["youtube"]
    none = client.get(f"{A}/summary", params={"platform": "nonexistent"}, headers=creator_headers).json()
    assert none["has_data"] is False and none["totals"]["views"] == 0


def test_invalid_range_422(client, creator_headers):
    r = client.get(f"{A}/summary", params={"start": "2026-02-01", "end": "2026-01-01"}, headers=creator_headers)
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_views_basis_when_no_reach(client, make_user):
    u = make_user("creator")
    r = client.post(f"{A}/entries", json={"title": "No reach", "views": 1000, "likes": 50, "platform": "instagram"}, headers=u.headers)
    assert r.status_code == 201
    s = client.get(f"{A}/summary", headers=u.headers).json()
    assert s["engagement"]["basis"] == "views" and s["engagement"]["rate"] == 5.0


def test_entries_crud_and_isolation(client, make_user):
    a, b = make_user("creator"), make_user("creator")
    created = client.post(f"{A}/entries", json={"title": "Mine", "views": 10, "category": "technology", "language": "mr"}, headers=a.headers).json()
    assert created["category"] == "Technology" and created["language"] == "mr"
    eid = created["id"]
    assert client.get(f"{A}/entries", headers=b.headers).json()["total"] == 0
    assert client.put(f"{A}/entries/{eid}", json={"views": 5}, headers=b.headers).status_code == 404
    assert client.delete(f"{A}/entries/{eid}", headers=b.headers).status_code == 404
    assert client.put(f"{A}/entries/{eid}", json={"views": 99}, headers=a.headers).json()["views"] == 99
    assert client.get(f"{A}/summary", headers=b.headers).json()["has_data"] is False
    assert client.delete(f"{A}/entries/{eid}", headers=a.headers).status_code == 200
    assert client.get(f"{A}/entries", headers=a.headers).json()["total"] == 0


def test_entry_validation(client, creator_headers):
    assert client.post(f"{A}/entries", json={"title": "x", "views": -1}, headers=creator_headers).status_code == 422
    assert client.post(f"{A}/entries", json={"title": "x", "platform": "nope"}, headers=creator_headers).status_code == 422


def test_analyze_endpoint_has_disclaimer(client, creator_headers):
    body = {"title": "T", "topic": "AI", "views": 1000, "likes": 90, "comments": 8, "shares": 10, "duration_seconds": 30,
            "category": "Technology", "language": "en", "reach": 800}
    d = client.post(f"{A}/analyze", json=body, headers=creator_headers).json()
    assert d["disclaimer"] == DISCLAIMER
    assert d["engagement"]["basis"] == "reach"
    assert {"performance", "content_pattern", "potential_strengths", "observations", "experiment_suggestions"} <= set(d)


def test_analyzer_never_promises_virality():
    for views, likes in ((0, 0), (100, 1), (100000, 12000)):
        out = analyze(title="t", views=views, likes=likes, comments=3, shares=2)
        text = str(out).lower()
        assert out["disclaimer"] and not any(p in text for p in FORBIDDEN_PHRASES)
        assert "cannot guarantee" in out["disclaimer"]


def test_recommendations_generate_dismiss_and_wording(client, creator_headers, make_user):
    items = client.get("/api/v1/recommendations", headers=creator_headers).json()["items"]
    assert len(items) == 4
    gen = client.post("/api/v1/recommendations/generate", headers=creator_headers).json()["items"]
    assert gen and all(not any(p in (i["description"] + i["title"]).lower() for p in FORBIDDEN_PHRASES) for i in gen)
    assert client.post(f"/api/v1/recommendations/{gen[0]['id']}/dismiss", headers=creator_headers).status_code == 200
    ids = [i["id"] for i in client.get("/api/v1/recommendations", headers=creator_headers).json()["items"]]
    assert gen[0]["id"] not in ids
    other = make_user("creator")
    assert client.post(f"/api/v1/recommendations/{gen[1]['id']}/dismiss", headers=other.headers).status_code == 404
    new = client.post("/api/v1/recommendations/generate", headers=other.headers).json()["items"]
    assert new and any(i["kind"] in ("topic", "engagement") for i in new)
