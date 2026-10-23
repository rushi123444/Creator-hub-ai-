def test_dashboard_shape_with_seed(client, creator_headers):
    r = client.get("/api/v1/dashboard", headers=creator_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["greeting_name"]
    assert set(d["stats"]) == {"total_views", "engagement_rate", "saved_ideas", "scheduled_posts", "ai_generations"}
    assert d["stats"]["total_views"] > 0
    assert len(d["trending"]) == 5 and d["recent_content"] and d["upcoming"] is not None
    assert len(d["recommendations"]) == 4
    assert set(d["charts"]) == {"views", "engagement", "platform", "category"} and d["charts"]["views"]
    assert d["is_sample_data"] is True


def test_dashboard_empty_user(client, make_user):
    u = make_user("creator", full_name="Asha Patil")
    d = client.get("/api/v1/dashboard", headers=u.headers).json()
    assert d["greeting_name"] == "Asha" and d["stats"]["total_views"] == 0 and d["charts"]["views"] == []


def test_dashboard_requires_auth(client):
    assert client.get("/api/v1/dashboard").status_code == 401
