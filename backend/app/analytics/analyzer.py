"""Content analyzer: rule-based, descriptive and cautious. It never predicts or promises virality."""
from __future__ import annotations

from datetime import date
from typing import Optional

from app.analytics.engagement import compute_engagement

DISCLAIMER = (
    "This is an analytical estimate based only on the numbers you entered. It does not predict future "
    "performance and cannot guarantee reach, views or virality. Results vary with audience, timing and platform."
)

# (minimum rate %, label) checked top to bottom.
_LABELS = ((8.0, "Strong engagement"), (4.0, "Healthy engagement"), (2.0, "Moderate engagement"),
           (0.0, "Room to grow"))


def _label(rate: float) -> str:
    return next(label for floor, label in _LABELS if rate >= floor)


def duration_class(seconds: Optional[int]) -> str:
    if not seconds:
        return "unspecified length"
    if seconds <= 30:
        return "very short-form (30 seconds or less)"
    if seconds <= 60:
        return "short-form (31-60 seconds)"
    if seconds <= 180:
        return "short-to-medium (1-3 minutes)"
    if seconds <= 600:
        return "medium-form (3-10 minutes)"
    return "long-form (over 10 minutes)"


def _ratio(part: int, whole: int) -> float:
    return round(part / whole * 100, 2) if whole > 0 else 0.0


def analyze(*, title: str = "", topic: Optional[str] = None, description: Optional[str] = None,
            duration_seconds: Optional[int] = None, category: Optional[str] = None, language: Optional[str] = None,
            views: int = 0, likes: int = 0, comments: int = 0, shares: int = 0, saves: int = 0,
            publication_date: Optional[date] = None, reach: Optional[int] = None) -> dict:
    eng = compute_engagement(likes, comments, shares, saves, reach, views)
    rate = eng["rate"]
    like_rate, comment_rate, share_rate = _ratio(likes, views), _ratio(comments, views), _ratio(shares, views)
    label = _label(rate)

    summary = (f"{eng['label']} is {rate}%, which falls in the '{label}' band of this tool's reference ranges. "
               f"Reference ranges are rules of thumb, not platform benchmarks.")
    if views <= 0:
        summary = "No views were entered, so there is not enough data to describe performance yet."

    strengths: list[str] = []
    observations: list[str] = []
    experiments: list[str] = []
    if like_rate >= 5:
        strengths.append(f"Likes are {like_rate}% of views, which suggests the content resonated with people who watched.")
    if comment_rate >= 0.4:
        strengths.append(f"Comments are {comment_rate}% of views, a sign the topic prompts discussion.")
    if share_rate >= 0.5:
        strengths.append(f"Shares are {share_rate}% of views, which suggests viewers found it worth passing on.")
    if saves and views and _ratio(saves, views) >= 0.8:
        strengths.append("A solid share of viewers saved this, which often points to reference value.")
    if not strengths:
        strengths.append("No clear standout signal in this data; a few more posts would make patterns easier to see.")

    if views > 0 and comment_rate < 0.2:
        observations.append("Comments are low relative to views. Ending with a specific question may invite more replies.")
    if views > 0 and share_rate < 0.2:
        observations.append("Shares are low relative to views. Content that is useful or relatable to a friend is shared more often.")
    if eng["basis"] == "views":
        observations.append("Reach was not provided, so engagement is views-based. Adding reach gives a more accurate rate.")
    if duration_seconds and duration_seconds > 90 and (category or "").lower() != "education":
        observations.append("The video is on the longer side; the data may show whether shorter cuts hold attention better.")
    if publication_date:
        observations.append(f"Published on {publication_date.isoformat()} ({publication_date.strftime('%A')}); compare with other weekdays over time.")
    if not observations:
        observations.append("Interaction ratios look balanced across likes, comments and shares.")

    experiments += [
        "Consider testing two different opening hooks on similar topics and compare the first-day engagement.",
        "Consider testing a clear call to action (comment, save or share) in half of your next posts.",
    ]
    if duration_seconds:
        experiments.append("Consider testing a version of this topic that is 10-20 seconds shorter or longer.")
    if language:
        experiments.append("Consider publishing the same idea in another language you speak and comparing results.")

    pattern_bits = [duration_class(duration_seconds)]
    if category:
        pattern_bits.append(f"{category} content")
    if language:
        pattern_bits.append({"en": "in English", "hi": "in Hindi", "mr": "in Marathi"}.get(language, f"in {language}"))
    content_pattern = "This looks like " + ", ".join(pattern_bits) + (f" about {topic}." if topic else ".")

    return {
        "performance": {"label": label if views > 0 else "Not enough data", "summary": summary},
        "engagement": {"rate": rate, "basis": eng["basis"], "formula": eng["formula"]},
        "content_pattern": content_pattern,
        "potential_strengths": strengths,
        "observations": observations,
        "experiment_suggestions": experiments,
        "disclaimer": DISCLAIMER,
    }
