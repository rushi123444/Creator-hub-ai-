"""Trend Score engine.

The Trend Score is a PROJECT-DEFINED analytical score (0-100). It is not an official platform metric.

    score = recency (0-25) + growth (0-25) + engagement (0-25) + topic frequency (0-25)

Each input is min-max normalised against a bounds range, scaled to 0-25, and the total is clamped to
0-100. Recency is inverted: the fewer days since the topic was last seen, the higher the points.
"""
from __future__ import annotations

import math
from typing import Iterable, Mapping, Optional, Sequence

COMPONENT_MAX = 25.0

# (min, max) ranges used when the caller does not supply bounds computed from a dataset.
DEFAULT_BOUNDS: dict[str, tuple[float, float]] = {
    "recency_days": (0.0, 30.0),
    "growth_pct": (-10.0, 300.0),
    "engagement_rate": (0.0, 15.0),
    "topic_frequency": (0.0, 200.0),
}

SCORE_DEFINITION = (
    "Trend Score is a project-defined analytical score (0-100) combining recency, growth, "
    "engagement and topic frequency. It is not an official platform metric."
)


def _num(value: object, default: float = 0.0) -> float:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    return number


def normalise(value: object, lo: float, hi: float) -> float:
    """Min-max normalise to 0..1, clamped. Degenerate bounds (hi <= lo) give 0."""
    lo, hi = _num(lo), _num(hi)
    if hi <= lo:
        return 0.0
    ratio = (_num(value, lo) - lo) / (hi - lo)
    return max(0.0, min(1.0, ratio))


def _merge_bounds(bounds: Optional[Mapping[str, Sequence[float]]]) -> dict[str, tuple[float, float]]:
    merged = dict(DEFAULT_BOUNDS)
    for key, pair in (bounds or {}).items():
        if key in merged and pair is not None and len(pair) == 2:
            merged[key] = (_num(pair[0]), _num(pair[1]))
    return merged


def compute_trend_score(
    recency_days: float,
    growth_pct: float,
    engagement_rate: float,
    topic_frequency: float,
    *,
    bounds: Optional[Mapping[str, Sequence[float]]] = None,
) -> dict:
    """Return {"score": float 0-100, "breakdown": {"recency","growth","engagement","frequency"}}.

    `bounds` may override any of: recency_days, growth_pct, engagement_rate, topic_frequency
    with (min, max) pairs, typically derived from the dataset with `bounds_from_items`.
    """
    b = _merge_bounds(bounds)
    recency = COMPONENT_MAX * (1.0 - normalise(recency_days, *b["recency_days"]))
    growth = COMPONENT_MAX * normalise(growth_pct, *b["growth_pct"])
    engagement = COMPONENT_MAX * normalise(engagement_rate, *b["engagement_rate"])
    frequency = COMPONENT_MAX * normalise(topic_frequency, *b["topic_frequency"])

    breakdown = {
        "recency": round(recency, 1),
        "growth": round(growth, 1),
        "engagement": round(engagement, 1),
        "frequency": round(frequency, 1),
    }
    total = round(sum(breakdown.values()), 1)
    return {"score": max(0.0, min(100.0, total)), "breakdown": breakdown}


def bounds_from_items(items: Iterable[Mapping[str, float]]) -> dict[str, tuple[float, float]]:
    """Derive min-max bounds from a dataset of dicts with the four input keys."""
    rows = list(items)
    if not rows:
        return dict(DEFAULT_BOUNDS)
    result: dict[str, tuple[float, float]] = {}
    for key in DEFAULT_BOUNDS:
        values = [_num(row.get(key)) for row in rows]
        result[key] = (min(values), max(values))
    return result
