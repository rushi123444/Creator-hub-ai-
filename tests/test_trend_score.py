"""Trend Score engine: bounds, normalisation, monotonicity, clamping."""
import pytest

from app.trends.score import SCORE_DEFINITION, bounds_from_items, compute_trend_score, normalise


def test_bounds_and_components():
    lo = compute_trend_score(30, -10, 0, 0)
    hi = compute_trend_score(0, 300, 15, 200)
    assert lo["score"] == 0.0 and hi["score"] == 100.0
    assert all(0 <= v <= 25 for v in hi["breakdown"].values())
    assert sum(hi["breakdown"].values()) == pytest.approx(100.0)


def test_clamps_out_of_range_inputs():
    assert compute_trend_score(-5, 9999, 999, 99999)["score"] == 100.0
    assert compute_trend_score(999, -999, -5, -5)["score"] == 0.0


def test_garbage_inputs_do_not_raise():
    res = compute_trend_score(None, "abc", float("nan"), float("inf"))
    assert 0 <= res["score"] <= 100


def test_normalise_degenerate_bounds():
    assert normalise(5, 3, 3) == 0.0
    assert normalise(5, 0, 10) == 0.5


@pytest.mark.parametrize("field,args", [("growth", (5, 50, 3, 40)), ("engagement", (5, 50, 3, 40)), ("frequency", (5, 50, 3, 40))])
def test_monotonic_in_each_input(field, args):
    base = list(args)
    idx = {"growth": 1, "engagement": 2, "frequency": 3}[field]
    bumped = list(args)
    bumped[idx] = args[idx] * 2
    assert compute_trend_score(*bumped)["score"] >= compute_trend_score(*base)["score"]


def test_more_recent_scores_higher():
    assert compute_trend_score(1, 50, 5, 50)["score"] > compute_trend_score(20, 50, 5, 50)["score"]


def test_dataset_bounds_normalisation():
    rows = [{"recency_days": 1, "growth_pct": 10, "engagement_rate": 2, "topic_frequency": 5},
            {"recency_days": 9, "growth_pct": 90, "engagement_rate": 8, "topic_frequency": 45}]
    b = bounds_from_items(rows)
    best = compute_trend_score(1, 90, 8, 45, bounds=b)
    assert best["score"] == 100.0
    assert "not an official platform metric" in SCORE_DEFINITION
