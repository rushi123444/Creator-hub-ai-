"""Engagement calculation (contract section 5).

Engagement Rate = (likes + comments + shares + saves) / reach x 100.
If reach is missing or 0 for the whole selection, views are used instead and the label becomes
"Engagement rate (views-based)". A zero denominator never raises; the rate is 0.0.
"""
from __future__ import annotations

from typing import Optional

REACH_FORMULA = "(likes + comments + shares + saves) / reach x 100"
VIEWS_FORMULA = "(likes + comments + shares + saves) / views x 100"
REACH_LABEL = "Engagement rate"
VIEWS_LABEL = "Engagement rate (views-based)"


def _int(value: object) -> int:
    try:
        number = int(value or 0)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0
    return max(0, number)


def compute_engagement(
    likes: Optional[int],
    comments: Optional[int],
    shares: Optional[int],
    saves: Optional[int],
    reach: Optional[int],
    views: Optional[int],
) -> dict:
    """Return {"rate": float (percent, 2dp), "basis": "reach"|"views", "formula": str, "label": str}."""
    interactions = _int(likes) + _int(comments) + _int(shares) + _int(saves)
    reach_n = _int(reach)
    views_n = _int(views)

    if reach_n > 0:
        basis, denominator, formula, label = "reach", reach_n, REACH_FORMULA, REACH_LABEL
    else:
        basis, denominator, formula, label = "views", views_n, VIEWS_FORMULA, VIEWS_LABEL

    rate = (interactions / denominator * 100.0) if denominator > 0 else 0.0
    return {"rate": round(rate, 2), "basis": basis, "formula": formula, "label": label}
