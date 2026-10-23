"""Dashboard composition from trends, analytics, content, calendar and recommendations."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics import aggregation as agg
from app.models.content import Content, ContentCalendar, ContentIdea
from app.models.insights import Trend
from app.models.system import AIRequest
from app.models.user import User
from app.services import recommendation_service
from app.services.content_service import calendar_out, content_out
from app.trends.service import trend_out


def _count(db: Session, model, *conds) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*conds)) or 0


def build_dashboard(db: Session, user: User) -> dict:
    now = datetime.now(timezone.utc)
    rows = agg.load_entries(db, user.id)
    summary = agg.summarize(db, rows)
    cutoff = (now - timedelta(days=30)).date().isoformat()

    trends = list(db.scalars(select(Trend).where(Trend.is_active.is_(True)).order_by(Trend.trend_score.desc()).limit(40)))
    cp, prof = getattr(user, "creator_profile", None), getattr(user, "profile", None)
    lang = prof.preferred_language if prof else None
    trends.sort(key=lambda t: (t.language_code != lang, cp is not None and t.category_id != cp.category_id, -t.trend_score))
    top_trends = [t for t in trends[:5]]

    recent = db.scalars(select(Content).where(Content.user_id == user.id).order_by(Content.updated_at.desc()).limit(5))
    upcoming = db.scalars(select(ContentCalendar).where(ContentCalendar.user_id == user.id, ContentCalendar.scheduled_at >= now,
                                                       ContentCalendar.status != "published")
                          .order_by(ContentCalendar.scheduled_at).limit(5))
    return {
        "greeting_name": (user.full_name or "there").split()[0],
        "stats": {
            "total_views": summary["totals"]["views"], "engagement_rate": summary["engagement"]["rate"],
            "saved_ideas": _count(db, ContentIdea, ContentIdea.user_id == user.id, ContentIdea.is_saved.is_(True)),
            "scheduled_posts": _count(db, Content, Content.user_id == user.id, Content.status == "scheduled"),
            "ai_generations": _count(db, AIRequest, AIRequest.user_id == user.id),
        },
        "engagement_label": summary["engagement"]["label"],
        "trending": [trend_out(db, t, with_history=False) for t in top_trends],
        "recent_content": [content_out(db, c) for c in recent],
        "upcoming": [calendar_out(db, e) for e in upcoming],
        "recommendations": recommendation_service.list_recommendations(db, user, limit=4),
        "charts": {
            "views": [p for p in summary["series"]["views"] if p["date"] >= cutoff],
            "engagement": [p for p in summary["series"]["engagement"] if p["date"] >= cutoff],
            "platform": [{"platform": p["platform"], "views": p["views"]} for p in summary["by_platform"]],
            "category": [{"category": c["category"], "views": c["views"]} for c in summary["by_category"]],
        },
        "is_sample_data": all(t.is_sample for t in top_trends) if top_trends else True,
    }
