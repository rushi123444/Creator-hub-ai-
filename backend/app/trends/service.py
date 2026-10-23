"""Trend queries, sample seeding and refresh. Scores always come from app.trends.score."""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.insights import Trend, TrendTopic
from app.models.reference import Category, Platform
from app.schemas.common import iso
from app.services import lookup
from app.trends import sample_data
from app.trends.score import SCORE_DEFINITION, bounds_from_items, compute_trend_score

logger = logging.getLogger("creatorhub.trends")
SAMPLE_NOTE = "Showing available sample insights."
LIVE_SOURCE = "YouTube Data API (public)"
SORTS = ("score", "growth", "engagement")


def _aware(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def recency_days(t: Trend) -> float:
    return max(0.0, (datetime.now(timezone.utc) - _aware(t.last_updated)).total_seconds() / 86400)


# ---- seeding --------------------------------------------------------------------------------------
def seed_sample_trends(db: Session) -> int:
    """Create the sample trends that do not exist yet (keyed by topic + language). Returns rows created."""
    existing = {(t, lang) for t, lang in db.execute(select(Trend.topic, Trend.language_code)).all()}
    cats = {c.name: c.id for c in db.scalars(select(Category))}
    plats = {p.slug: p.id for p in db.scalars(select(Platform))}
    specs = [s for s in sample_data.TREND_SPECS if (s[0], s[3]) not in existing]
    if not specs:
        return 0
    bounds = bounds_from_items(
        {"recency_days": s[8], "growth_pct": s[4], "engagement_rate": s[5], "topic_frequency": s[7]}
        for s in sample_data.TREND_SPECS
    )
    now = datetime.now(timezone.utc)
    for topic, cat, plat, lang, growth, eng, count, freq, rec, related in specs:
        res = compute_trend_score(rec, growth, eng, freq, bounds=bounds)
        trend = Trend(
            topic=topic, category_id=cats.get(cat), platform_id=plats.get(plat), language_code=lang,
            trend_score=res["score"], score_breakdown=res["breakdown"], growth_pct=float(growth),
            engagement_rate=float(eng), content_count=count, topic_frequency=freq, related_topics=list(related),
            history=sample_data.build_history(topic, res["score"], growth, end=now.date()),
            source=sample_data.SAMPLE_SOURCE, is_sample=True, is_active=True,
            last_updated=now - timedelta(days=rec),
        )
        trend.topics = [TrendTopic(keyword=k, frequency=f) for k, f in sample_data.keywords_for(topic, related, freq)]
        db.add(trend)
    db.commit()
    return len(specs)


# ---- serialisation --------------------------------------------------------------------------------
def trend_out(db: Session, t: Trend, *, with_history: bool = True) -> dict:
    return {
        "id": str(t.id), "topic": t.topic, "category": lookup.category_name(db, t.category_id),
        "platform": lookup.platform_slug(db, t.platform_id), "language": t.language_code,
        "trend_score": t.trend_score, "score_breakdown": t.score_breakdown or {},
        "growth_pct": t.growth_pct, "engagement_rate": t.engagement_rate, "content_count": t.content_count,
        "related_topics": list(t.related_topics or []), "source": t.source,
        "last_updated": iso(t.last_updated), "is_sample": t.is_sample,
        "history": list(t.history or []) if with_history else [],
    }


# ---- queries --------------------------------------------------------------------------------------
def query_trends(db: Session, *, platform: Optional[str] = None, category: Optional[str] = None,
                 language: Optional[str] = None, days: Optional[int] = None, q: Optional[str] = None,
                 sort: str = "score", limit: int = 50) -> list[Trend]:
    stmt = select(Trend).where(Trend.is_active.is_(True))
    if platform:
        pid = lookup.platform_id(db, platform)
        stmt = stmt.where(Trend.platform_id == (pid if pid is not None else -1))
    if category:
        cid = lookup.category_id(db, category)
        stmt = stmt.where(Trend.category_id == (cid if cid is not None else -1))
    if language:
        stmt = stmt.where(Trend.language_code == (lookup.language_code(language) or language))
    rows = list(db.scalars(stmt))
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        rows = [t for t in rows if _aware(t.last_updated) >= cutoff]
    if q and q.strip():
        needle = q.strip().lower()
        rows = [t for t in rows if needle in t.topic.lower() or any(needle in str(r).lower() for r in t.related_topics or [])]
    key = {"growth": lambda t: t.growth_pct, "engagement": lambda t: t.engagement_rate}.get(sort, lambda t: t.trend_score)
    rows.sort(key=key, reverse=True)
    return rows[: max(1, min(limit, 200))]


def build_charts(db: Session, rows: list[Trend]) -> dict:
    top = rows[:5]
    dates = sorted({h["date"] for t in top for h in (t.history or []) if "date" in h})
    growth = []
    for d in dates:
        point: dict = {"date": d}
        vals = []
        for t in top:
            val = next((h["score"] for h in t.history or [] if h.get("date") == d), None)
            if val is not None:
                point[t.topic] = val
                vals.append(val)
        point["score"] = round(sum(vals) / len(vals), 1) if vals else 0
        growth.append(point)

    freq: Counter = Counter()
    ids = [t.id for t in rows]
    if ids:
        for kw, f in db.execute(select(TrendTopic.keyword, TrendTopic.frequency).where(TrendTopic.trend_id.in_(ids))):
            freq[kw] += f
    frequency = [{"keyword": k, "frequency": v} for k, v in freq.most_common(10)]

    by_cat: dict[str, list[float]] = defaultdict(list)
    for t in rows:
        by_cat[lookup.category_name(db, t.category_id) or "Other"].append(t.trend_score)
    categories = sorted(
        ({"category": c, "avg_score": round(sum(v) / len(v), 1), "count": len(v)} for c, v in by_cat.items()),
        key=lambda r: r["avg_score"], reverse=True,
    )
    return {"growth": growth, "frequency": frequency, "categories": categories}


def list_trends_response(db: Session, **filters) -> dict:
    rows = query_trends(db, **filters)
    is_sample = all(t.is_sample for t in rows)
    return {
        "items": [trend_out(db, t) for t in rows],
        "charts": build_charts(db, rows),
        "source": "sample" if is_sample else "live",
        "note": SAMPLE_NOTE if is_sample else None,
        "score_definition": SCORE_DEFINITION,
    }


# ---- refresh --------------------------------------------------------------------------------------
def _live_candidates(db: Session) -> list[dict]:
    """Public YouTube videos per category -> candidate trends. Raises YouTubeError on any failure."""
    from app.services import youtube_service as yt

    now = datetime.now(timezone.utc)
    out: list[dict] = []
    for cat in db.scalars(select(Category).where(Category.is_active.is_(True))):
        for lang in ("en", "hi", "mr"):
            videos = yt.search_videos(f"{cat.name} {sample_data.LANG_HINT[lang]}", language=lang, days=14, max_results=6)
            tag_counts: Counter = Counter(tag.lower() for v in videos for tag in v["tags"])
            for v in videos[:3]:
                if not v["views"] or not v["title"]:
                    continue
                try:
                    published = datetime.fromisoformat(v["published_at"].replace("Z", "+00:00"))
                except (AttributeError, ValueError):
                    published = now
                age_days = max(0.5, (now - published).total_seconds() / 86400)
                out.append({
                    "topic": v["title"][:200], "category_id": cat.id, "language": lang,
                    "growth_pct": round(min(300.0, v["views"] / age_days / 1000), 1),
                    "engagement": round((v["likes"] + v["comments"]) / v["views"] * 100, 2),
                    "freq": max(1, sum(tag_counts[t.lower()] for t in v["tags"])) * 5,
                    "recency": min(age_days, 30.0), "related": [t for t in v["tags"][:4]],
                    "content_count": len(videos),
                })
    if not out:
        raise yt.YouTubeError("no results")
    return out


def refresh_trends(db: Session) -> dict:
    """Never raises. Live data when a YouTube key is configured and reachable, else sample data."""
    from app.services import youtube_service as yt

    if yt.is_enabled():
        try:
            cands = _live_candidates(db)
            bounds = bounds_from_items(
                {"recency_days": c["recency"], "growth_pct": c["growth_pct"], "engagement_rate": c["engagement"],
                 "topic_frequency": c["freq"]} for c in cands
            )
            yt_id = lookup.platform_id(db, "youtube")
            now = datetime.now(timezone.utc)
            updated = 0
            for c in cands:
                res = compute_trend_score(c["recency"], c["growth_pct"], c["engagement"], c["freq"], bounds=bounds)
                t = db.scalar(select(Trend).where(Trend.topic == c["topic"], Trend.language_code == c["language"]))
                if t is None:
                    t = Trend(topic=c["topic"], language_code=c["language"], history=[])
                    db.add(t)
                t.category_id, t.platform_id = c["category_id"], yt_id
                t.trend_score, t.score_breakdown = res["score"], res["breakdown"]
                t.growth_pct, t.engagement_rate = c["growth_pct"], c["engagement"]
                t.content_count, t.topic_frequency, t.related_topics = c["content_count"], c["freq"], c["related"]
                t.source, t.is_sample, t.is_active, t.last_updated = LIVE_SOURCE, False, True, now
                t.history = (list(t.history or []) + [{"date": now.date().isoformat(), "score": res["score"]}])[-60:]
                updated += 1
            db.commit()
            return {"source": "live", "updated": updated, "note": None}
        except yt.YouTubeError:
            db.rollback()
            logger.info("Live trend refresh unavailable; using sample trends")
        except Exception:  # defensive: refresh must never surface an error
            db.rollback()
            logger.exception("Unexpected error during trend refresh; using sample trends")
    created = seed_sample_trends(db)
    total = db.query(Trend).filter(Trend.is_sample.is_(True)).count()
    return {"source": "sample", "updated": created or total, "note": SAMPLE_NOTE}
