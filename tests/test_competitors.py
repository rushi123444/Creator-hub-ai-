C = "/api/v1/competitors"


def test_sample_analysis_shape_and_public_note(client, creator_headers):
    r = client.post(f"{C}/analyze", json={"platform": "youtube", "handle_or_url": "@techwithraj"}, headers=creator_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["is_sample"] is True and "public information only" in d["note"]
    for key in ("id", "display_name", "topics", "titles", "posting_frequency", "avg_duration_seconds", "views", "likes",
                "comments", "categories", "frequent_topics", "popular_formats", "posting_patterns", "content_gaps"):
        assert key in d
    assert d["titles"] and d["popular_formats"] and d["content_gaps"]


def test_deterministic_and_instagram(client, creator_headers):
    body = {"platform": "instagram", "handle_or_url": "fitness_guru"}
    a = client.post(f"{C}/analyze", json=body, headers=creator_headers).json()
    b = client.post(f"{C}/analyze", json=body, headers=creator_headers).json()
    assert a["titles"] == b["titles"] and a["views"] == b["views"] and a["id"] != b["id"]
    assert "Fitness" in a["categories"]


def test_list_get_delete_and_isolation(client, creator_headers, make_user):
    cid = client.post(f"{C}/analyze", json={"platform": "youtube", "handle_or_url": "https://youtube.com/@gamer"}, headers=creator_headers).json()["id"]
    assert client.get(C, headers=creator_headers).json()["total"] == 1
    other = make_user("creator")
    assert client.get(f"{C}/{cid}", headers=other.headers).status_code == 404
    assert client.delete(f"{C}/{cid}", headers=other.headers).status_code == 404
    assert client.get(f"{C}/{cid}", headers=creator_headers).status_code == 200
    assert client.delete(f"{C}/{cid}", headers=creator_headers).status_code == 200
    assert client.get(C, headers=creator_headers).json()["total"] == 0


def test_validation(client, creator_headers):
    assert client.post(f"{C}/analyze", json={"platform": "youtube", "handle_or_url": "x"}, headers=creator_headers).status_code == 422
