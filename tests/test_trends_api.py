from app.trends.service import seed_sample_trends

T = "/api/v1/trends"


def test_list_shape_and_definition(client, creator_headers):
    d = client.get(T, params={"limit": 200}, headers=creator_headers).json()
    assert len(d["items"]) >= 36 and d["source"] == "sample" and d["note"] == "Showing available sample insights."
    assert d["score_definition"].startswith("Trend Score is a project-defined analytical score (0-100)")
    t = d["items"][0]
    assert {"id", "topic", "category", "platform", "language", "trend_score", "score_breakdown", "growth_pct",
            "engagement_rate", "content_count", "related_topics", "source", "last_updated", "is_sample", "history"} <= set(t)
    assert len(t["history"]) == 30 and set(t["score_breakdown"]) == {"recency", "growth", "engagement", "frequency"}
    assert {"growth", "frequency", "categories"} <= set(d["charts"]) and d["charts"]["growth"] and d["charts"]["frequency"]
    scores = [i["trend_score"] for i in d["items"]]
    assert scores == sorted(scores, reverse=True)


def test_sample_covers_categories_languages_platforms(client, creator_headers):
    items = client.get(T, params={"limit": 200}, headers=creator_headers).json()["items"]
    assert {i["category"] for i in items} == {"Technology", "Education", "Gaming", "Business", "Entertainment", "Fitness"}
    assert {i["language"] for i in items} == {"en", "hi", "mr"}
    assert {"instagram", "youtube", "youtube_shorts"} <= {i["platform"] for i in items}


def test_filters_and_sort(client, creator_headers):
    d = client.get(T, params={"language": "mr", "category": "Technology", "platform": "instagram"}, headers=creator_headers).json()
    assert d["items"] and all(i["language"] == "mr" and i["category"] == "Technology" for i in d["items"])
    q = client.get(T, params={"q": "python"}, headers=creator_headers).json()["items"]
    assert q and all("python" in (i["topic"] + " ".join(i["related_topics"])).lower() for i in q)
    g = [i["growth_pct"] for i in client.get(T, params={"sort": "growth"}, headers=creator_headers).json()["items"]]
    assert g == sorted(g, reverse=True)
    assert client.get(T, params={"sort": "bogus"}, headers=creator_headers).status_code == 422
    assert client.get(T, params={"days": 1}, headers=creator_headers).json()["items"]


def test_detail_and_not_found(client, creator_headers):
    tid = client.get(T, headers=creator_headers).json()["items"][0]["id"]
    assert client.get(f"{T}/{tid}", headers=creator_headers).json()["id"] == tid
    assert client.get(f"{T}/not-a-uuid", headers=creator_headers).status_code == 404


def test_refresh_without_key_is_sample_200(client, creator_headers):
    r = client.post(f"{T}/refresh", headers=creator_headers)
    assert r.status_code == 200 and r.json()["source"] == "sample" and r.json()["updated"] > 0


def test_seed_is_idempotent(db):
    assert seed_sample_trends(db) == 0


def test_requires_auth(client):
    assert client.get(T).status_code == 401
