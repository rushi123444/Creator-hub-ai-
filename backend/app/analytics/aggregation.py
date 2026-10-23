"""Aggregation of analytics entries: totals, daily series and breakdowns. Pure over loaded rows."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Callable, Iterable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.engagement import compute_engagement
from app.models.insights import AnalyticsEntry
from app.models.reference import Category, Platform
from app.services import lookup

TOTAL_FIELDS = ("views", "likes", "comments", "shares", "saves", "reach", "watch_time_minutes", "followers_gained")


class Names:
    """Cached id -> slug/name maps so aggregation does not query per row."""

    def __init__(self, db: Session):
        self.platforms = {p.id: p.slug for p in db.scalars(select(Platform))}
        self.categories = {c.id: c.name for c in db.scalars(select(Category))}

    def platform(self, pid: Optional[int]) -> str:
        return self.platforms.get(pid, "other") if pid else "other"

    def category(self, cid: Optional[int]) -> str:
        return self.categories.get(cid, "Other") if cid else "Other"


def load_entries(db: Session, user_id, *, start: Optional[date] = None, end: Optional[date] = None,
                 platform: Optional[str] = None, category: Optional[str] = None,
                 language: Optional[str] = None) -> list[AnalyticsEntry]:
    """Only the given user's rows, optionally filtered. Unknown platform/category => empty result."""
    stmt = select(AnalyticsEntry).where(AnalyticsEntry.user_id == user_id)
    if start:
        stmt = stmt.where(AnalyticsEntry.recorded_on >= start)
    if end:
        stmt = stmt.where(AnalyticsEntry.recorded_on <= end)
    if platform:
        pid = lookup.platform_id(db, platform)
        stmt = stmt.where(AnalyticsEntry.platform_id == (pid if pid is not None else -1))
    if category:
        cid = lookup.category_id(db, category)
        stmt = stmt.where(AnalyticsEntry.category_id == (cid if cid is not None else -1))
    if language:
        stmt = stmt.where(AnalyticsEntry.language_code == (lookup.language_code(language) or language))
    return list(db.scalars(stmt.order_by(AnalyticsEntry.recorded_on)))


def engagement_for(rows: Iterable[AnalyticsEntry]) -> dict:
    """Engagement for a selection. Reach basis uses only rows that have reach (like-for-like);
    if none has reach the views basis is used for every row."""
    rows = list(rows)
    with_reach = [r for r in rows if (r.reach or 0) > 0]
    basis_rows = with_reach or rows

    def s(field: str) -> int:
        return sum(int(getattr(r, field) or 0) for r in basis_rows)

    return compute_engagement(s("likes"), s("comments"), s("shares"), s("saves"),
                              s("reach") if with_reach else None, s("views"))


def totals_for(rows: Iterable[AnalyticsEntry]) -> dict:
    out: dict = {f: 0 for f in TOTAL_FIELDS}
    for r in rows:
        for f in TOTAL_FIELDS:
            out[f] += getattr(r, f) or 0
    out["watch_time_minutes"] = round(out["watch_time_minutes"], 1)
    return out


def _group(rows: list[AnalyticsEntry], key_fn: Callable[[AnalyticsEntry], str], label: str) -> list[dict]:
    buckets: dict[str, list[AnalyticsEntry]] = defaultdict(list)
    for r in rows:
        buckets[key_fn(r)].append(r)
    items = []
    for key, group in buckets.items():
        t = totals_for(group)
        items.append({label: key, "count": len(group), "views": t["views"], "likes": t["likes"],
                      "comments": t["comments"], "shares": t["shares"], "saves": t["saves"],
                      "engagement_rate": engagement_for(group)["rate"]})
    return sorted(items, key=lambda i: i["views"], reverse=True)


def entry_out(names: Names, e: AnalyticsEntry) -> dict:
    return {
        "id": str(e.id), "content_id": str(e.content_id) if e.content_id else None, "title": e.title,
        "topic": e.topic, "platform": names.platform(e.platform_id) if e.platform_id else None,
        "category": names.category(e.category_id) if e.category_id else None, "language": e.language_code,
        "recorded_on": e.recorded_on.isoformat(),
        "publication_date": e.publication_date.isoformat() if e.publication_date else None,
        "duration_seconds": e.duration_seconds, "views": e.views, "likes": e.likes, "comments": e.comments,
        "shares": e.shares, "saves": e.saves, "reach": e.reach, "watch_time_minutes": e.watch_time_minutes,
        "followers_gained": e.followers_gained,
        "engagement_rate": compute_engagement(e.likes, e.comments, e.shares, e.saves, e.reach, e.views)["rate"],
    }


def summarize(db: Session, rows: list[AnalyticsEntry]) -> dict:
    names = Names(db)
    by_day: dict[date, list[AnalyticsEntry]] = defaultdict(list)
    for r in rows:
        by_day[r.recorded_on].append(r)
    days = sorted(by_day)
    eng = engagement_for(rows)
    top = sorted(rows, key=lambda r: r.views, reverse=True)[:10]
    return {
        "totals": totals_for(rows),
        "engagement": eng,
        "series": {
            "views": [{"date": d.isoformat(), "value": sum(r.views for r in by_day[d])} for d in days],
            "engagement": [{"date": d.isoformat(), "value": engagement_for(by_day[d])["rate"]} for d in days],
        },
        "by_platform": _group(rows, lambda r: names.platform(r.platform_id), "platform"),
        "by_category": _group(rows, lambda r: names.category(r.category_id), "category"),
        "by_language": _group(rows, lambda r: r.language_code, "language"),
        "by_content": [entry_out(names, r) for r in top],
        "has_data": bool(rows),
    }
