"""Rule-based recommendations over the user's analytics, current trends and profile.

Wording is analytical ("your data suggests", "consider testing"); nothing promises an outcome.
When OpenAI is configured the wording is polished by AIService; the rule-based text is the fallback.
"""
from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.analytics import aggregation as agg
from app.models.insights import Recommendation, Trend
from app.models.user import User
from app.schemas.common import iso
from app.services import lookup

logger = logging.getLogger("creatorhub.recommendations")
MIN_ENTRIES = 5       # below this the data is too thin for pattern rules
MIN_GROUP = 3         # minimum entries in a bucket before it is compared
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
LANG_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi"}
PLATFORM_NAMES = {"instagram": "Instagram", "youtube": "YouTube", "youtube_shorts": "YouTube Shorts"}


def _duration_bin(seconds: Optional[int]) -> Optional[str]:
    if not seconds:
        return None
    if seconds <= 30:
        return "up to 30 seconds"
    if seconds <= 60:
        return "31-60 seconds"
    if seconds <= 180:
        return "1-3 minutes"
    return "over 3 minutes"


def _best(rows, key_fn, metric: str = "rate"):
    """Return (key, rate, avg_views, n, runner_up_rate) for the best bucket with enough rows, else None."""
    buckets = defaultdict(list)
    for r in rows:
        k = key_fn(r)
        if k is not None:
            buckets[k].append(r)
    stats = []
    for k, grp in buckets.items():
        if len(grp) >= MIN_GROUP:
            avg_views = sum(r.views for r in grp) / len(grp)
            stats.append((k, agg.engagement_for(grp)["rate"], avg_views, len(grp)))
    if len(stats) < 2:
        return None
    idx = 1 if metric == "rate" else 2
    stats.sort(key=lambda s: s[idx], reverse=True)
    return (*stats[0], stats[1][idx])


def _profile(db: Session, user: User) -> dict:
    cp, prof = getattr(user, "creator_profile", None), getattr(user, "profile", None)
    return {
        "category_id": cp.category_id if cp else None, "platform_id": cp.platform_id if cp else None,
        "language": (prof.preferred_language if prof else None) or "en",
    }


def _trend_candidates(db: Session, profile: dict, limit: int = 2) -> list[dict]:
    stmt = select(Trend).where(Trend.is_active.is_(True))
    if profile["category_id"]:
        stmt = stmt.where(Trend.category_id == profile["category_id"])
    rows = [t for t in db.scalars(stmt.order_by(Trend.trend_score.desc()).limit(30))]
    rows.sort(key=lambda t: (t.language_code != profile["language"], -t.trend_score))
    out = []
    for t in rows[:limit]:
        out.append({
            "kind": "topic", "title": f"Explore the rising topic: {t.topic}",
            "description": (f"Trend data suggests '{t.topic}' is gaining attention (project Trend Score "
                            f"{t.trend_score:.0f}/100, growth {t.growth_pct:.0f}%). Consider testing one short piece on it "
                            "and comparing the results with your usual content."),
            "rationale": "Based on the project-defined Trend Score and the topics matching your profile. It is an "
                         "analytical signal, not a prediction.",
            "category_id": t.category_id, "platform_id": t.platform_id, "language_code": t.language_code,
        })
    return out


def build_candidates(db: Session, user: User) -> list[dict]:
    profile = _profile(db, user)
    rows = agg.load_entries(db, user.id)
    cands: list[dict] = []
    if len(rows) >= MIN_ENTRIES:
        names = agg.Names(db)
        if b := _best(rows, lambda r: r.category_id):
            cid, rate, _, n, other = b
            cands.append({
                "kind": "topic", "title": f"{names.category(cid)} content shows your strongest engagement",
                "description": (f"Your data suggests {names.category(cid)} posts reach an engagement rate of {rate}% "
                                f"across {n} posts. Consider testing more topics in this category."),
                "rationale": f"The next best category in your data is at {other}%. Small samples can mislead, so keep comparing.",
                "category_id": cid, "platform_id": None, "language_code": None})
        if b := _best(rows, lambda r: r.language_code):
            code, rate, _, n, other = b
            cands.append({
                "kind": "language", "title": f"{LANG_NAMES.get(code, code)} posts perform well for you",
                "description": (f"{LANG_NAMES.get(code, code)} posts average {rate}% engagement across {n} posts versus "
                                f"{other}% for the next language. Consider testing more ideas in {LANG_NAMES.get(code, code)}."),
                "rationale": "Calculated from your own analytics entries; audience mix and topics also affect these numbers.",
                "category_id": None, "platform_id": None, "language_code": code})
        if b := _best(rows, lambda r: r.platform_id, metric="views"):
            pid, _, avg_views, n, other = b
            slug = names.platform(pid)
            cands.append({
                "kind": "platform", "title": f"{PLATFORM_NAMES.get(slug, slug)} brings more views per post",
                "description": (f"Posts on {PLATFORM_NAMES.get(slug, slug)} average about {avg_views:,.0f} views ({n} posts), "
                                f"compared with about {other:,.0f} on your next platform. Consider prioritising it while still testing others."),
                "rationale": "Average views per post from your analytics entries.",
                "category_id": None, "platform_id": pid, "language_code": None})
        if b := _best(rows, lambda r: _duration_bin(r.duration_seconds)):
            label, rate, _, n, other = b
            cands.append({
                "kind": "format", "title": f"Videos of {label} engage best so far",
                "description": (f"Your {label} videos show {rate}% engagement ({n} posts) against {other}% for the next best length. "
                                "Consider testing this duration on your next few posts."),
                "rationale": "Duration buckets are compared using the same engagement formula as the analytics page.",
                "category_id": None, "platform_id": None, "language_code": None})
        if b := _best(rows, lambda r: r.recorded_on.weekday(), metric="views"):
            day, _, avg_views, n, _ = b
            cands.append({
                "kind": "timing", "title": f"{WEEKDAYS[day]} posts get more views on average",
                "description": (f"Posts recorded on {WEEKDAYS[day]} average about {avg_views:,.0f} views ({n} posts). "
                                f"Consider testing a {WEEKDAYS[day]} slot and tracking whether the pattern holds."),
                "rationale": "Posting-day patterns are small-sample observations and can change with audience habits.",
                "category_id": None, "platform_id": None, "language_code": None})
        totals = agg.totals_for(rows)
        if totals["views"] and totals["comments"] / totals["views"] * 100 < 0.5:
            cands.append({
                "kind": "engagement", "title": "Invite more comments",
                "description": ("Comments are a small share of views in your data. Consider testing a specific question "
                                "or prompt at the end of your posts and compare comment counts."),
                "rationale": f"Comments are {totals['comments'] / totals['views'] * 100:.2f}% of views across your entries.",
                "category_id": None, "platform_id": None, "language_code": None})
    cands += _trend_candidates(db, profile)
    if len(rows) < MIN_ENTRIES:
        cands.append({
            "kind": "engagement", "title": "Add your post results to unlock personal insights",
            "description": "Once you log at least five posts in Analytics, recommendations will reflect your own results.",
            "rationale": "There is not enough personal data yet, so suggestions rely on trends and your profile.",
            "category_id": None, "platform_id": None, "language_code": None})
    return cands


def recommendation_out(db: Session, r: Recommendation) -> dict:
    return {
        "id": str(r.id), "kind": r.kind, "title": r.title, "description": r.description, "rationale": r.rationale,
        "category": lookup.category_name(db, r.category_id), "platform": lookup.platform_slug(db, r.platform_id),
        "language": r.language_code, "is_dismissed": r.is_dismissed, "created_at": iso(r.created_at),
    }


def list_recommendations(db: Session, user: User, limit: int = 20) -> list[dict]:
    stmt = (select(Recommendation).where(Recommendation.user_id == user.id, Recommendation.is_dismissed.is_(False))
            .order_by(Recommendation.created_at.desc()).limit(limit))
    return [recommendation_out(db, r) for r in db.scalars(stmt)]


def _store(db: Session, user_id, cands: list[dict]) -> list[Recommendation]:
    rows = [Recommendation(user_id=user_id, **c) for c in cands]
    db.add_all(rows)
    db.commit()
    return rows


def generate_recommendations(db: Session, user: User) -> list[dict]:
    """Replace the user's open recommendations with freshly computed ones (dismissed ones are kept)."""
    cands = build_candidates(db, user)[:8]
    try:  # AI-polished wording when available; any failure keeps the rule-based text
        from app.ai.service import AIService

        svc = AIService(db, user)
        ctx = svc.context({})
        items = [{"id": str(i), "title": c["title"], "description": c["description"]} for i, c in enumerate(cands)]
        polished = svc.polish_recommendations(ctx, items) or {}
        for i, c in enumerate(cands):
            if (p := polished.get(str(i))):
                c["title"], c["description"] = p["title"][:200], p["description"]
    except Exception:  # polishing is optional and must never break generation
        logger.info("Recommendation wording polish skipped")
    db.execute(delete(Recommendation).where(Recommendation.user_id == user.id, Recommendation.is_dismissed.is_(False)))
    rows = _store(db, user.id, cands)
    return [recommendation_out(db, r) for r in rows]


def dismiss_recommendation(db: Session, user: User, rec_id: str) -> Optional[dict]:
    try:
        rid = uuid.UUID(rec_id)
    except ValueError:
        return None
    rec = db.get(Recommendation, rid)
    if rec is None or rec.user_id != user.id:
        return None
    rec.is_dismissed = True
    db.commit()
    return recommendation_out(db, rec)


def seed_demo_recommendations(db: Session, user_id) -> int:
    """Four demo recommendations for the demo creator (idempotent)."""
    if db.scalar(select(func.count()).select_from(Recommendation).where(Recommendation.user_id == user_id)):
        return 0
    user = db.get(User, user_id)
    if user is None:
        return 0
    cands = build_candidates(db, user)
    cands = cands[:4]
    _store(db, user_id, cands)
    return len(cands)
