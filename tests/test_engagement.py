from app.analytics.engagement import compute_engagement


def test_reach_basis():
    r = compute_engagement(50, 10, 20, 20, 1000, 5000)
    assert r["basis"] == "reach" and r["rate"] == 10.0 and r["label"] == "Engagement rate"


def test_views_fallback_when_reach_missing_or_zero():
    for reach in (None, 0):
        r = compute_engagement(50, 10, 20, 20, reach, 2000)
        assert r["basis"] == "views" and r["rate"] == 5.0
        assert r["label"] == "Engagement rate (views-based)"


def test_zero_division_is_safe():
    r = compute_engagement(5, 5, 5, 5, None, 0)
    assert r["rate"] == 0.0 and r["basis"] == "views"
    assert compute_engagement(None, None, None, None, None, None)["rate"] == 0.0
