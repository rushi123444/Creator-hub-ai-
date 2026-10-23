"""Admin surface: every route requires role `admin` (others get 403)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select

from app.errors import ConflictError, NotFoundError, ValidationFailed
from app.models.content import Content
from app.models.insights import Trend
from app.models.reference import Category
from app.models.system import AIRequest, PlatformSetting, Report
from app.models.user import EditorProfile, User
from app.routers.deps import AdminUser, DbSession, require_admin
from app.schemas.common import iso
from app.schemas.editors import (
    AdminEditorIn, AdminEditorUpdate, AdminUserPatch, CategoryIn, CategoryUpdate, ModerationIn,
    ReportUpdateIn, SettingsIn, TrendAdminIn, TrendAdminUpdate,
)
from app.services import editor_service as esvc
from app.services import lookup
from app.services.content_service import resolve_category, resolve_platform
from app.services.lookup import slugify
from app.services.notification_service import notify
from app.trends.score import compute_trend_score

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise NotFoundError()


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _user_out(u: User) -> dict:
    return {"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active,
            "created_at": iso(u.created_at), "last_login_at": iso(u.last_login_at),
            "profile_completed": bool(u.profile.profile_completed) if u.profile else False}


# ---- overview -----------------------------------------------------------------------------
@router.get("/overview")
def overview(db: DbSession):
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    by_role = db.execute(select(User.role, func.count()).group_by(User.role)).all()
    roles = {r: n for r, n in by_role}
    recent = db.scalars(select(User).order_by(User.created_at.desc()).limit(6)).all()
    day = func.date(AIRequest.created_at)
    by_day = db.execute(select(day, func.count()).where(AIRequest.created_at >= _since(14))
                        .group_by(day).order_by(day)).all()
    return {
        "total_users": count(User), "total_creators": roles.get("creator", 0), "total_editors": roles.get("editor", 0),
        "total_content": count(Content), "total_ai_requests": count(AIRequest), "total_categories": count(Category),
        "reported_profiles": count(Report, Report.status == "open"),
        "recent_signups": [_user_out(u) for u in recent],
        "ai_requests_by_day": [{"date": str(d), "count": n} for d, n in by_day],
        "users_by_role": [{"role": r, "count": n} for r, n in sorted(roles.items())],
    }


# ---- users ----------------------------------------------------------------------------------
@router.get("/users")
def list_users(db: DbSession, q: Optional[str] = Query(None, max_length=100), role: Optional[str] = Query(None, max_length=20),
               active: Optional[bool] = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    sel = select(User)
    if q:
        like = f"%{q.strip().lower()}%"
        sel = sel.where(or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like)))
    if role:
        sel = sel.where(User.role == role)
    if active is not None:
        sel = sel.where(User.is_active.is_(active))
    total = db.scalar(select(func.count()).select_from(sel.subquery())) or 0
    rows = db.scalars(sel.order_by(User.created_at.desc()).limit(limit).offset(offset)).all()
    return {"items": [_user_out(u) for u in rows], "total": total}


@router.patch("/users/{user_id}")
def patch_user(user_id: str, body: AdminUserPatch, admin: AdminUser, db: DbSession):
    u = db.get(User, _uuid(user_id))
    if u is None:
        raise NotFoundError()
    if u.id == admin.id and body.is_active is False:
        raise ValidationFailed("You cannot deactivate your own account.")
    if u.role == "admin" and body.role is not None:
        raise ValidationFailed("Admin accounts cannot be changed to another role here.")
    if u.role == "admin" and body.is_active is False:
        raise ValidationFailed("Admin accounts cannot be deactivated here.")
    if body.is_active is not None:
        u.is_active = body.is_active
    if body.role is not None:
        u.role = body.role
    if body.full_name is not None:
        u.full_name = body.full_name
    db.commit()
    return _user_out(u)


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: AdminUser, db: DbSession):
    u = db.get(User, _uuid(user_id))
    if u is None:
        raise NotFoundError()
    if u.id == admin.id:
        raise ValidationFailed("You cannot delete your own account.")
    if u.role == "admin" and (db.scalar(select(func.count()).select_from(User).where(User.role == "admin")) or 0) <= 1:
        raise ValidationFailed("The last admin account cannot be deleted.")
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/creators")
def list_creators(db: DbSession, q: Optional[str] = Query(None, max_length=100), limit: int = Query(100, ge=1, le=500)):
    sel = select(User).where(User.role == "creator")
    if q:
        like = f"%{q.strip().lower()}%"
        sel = sel.where(or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like)))
    rows = db.scalars(sel.order_by(User.created_at.desc()).limit(limit)).all()
    counts = dict(db.execute(select(Content.user_id, func.count()).group_by(Content.user_id)).all())
    items = []
    for u in rows:
        cp = u.creator_profile
        items.append({**_user_out(u), "content_count": counts.get(u.id, 0),
                      "category": lookup.category_name(db, cp.category_id) if cp else None,
                      "platform": lookup.platform_slug(db, cp.platform_id) if cp else None,
                      "preferred_language": u.profile.preferred_language if u.profile else "en"})
    return {"items": items, "total": len(items)}


# ---- content --------------------------------------------------------------------------------
@router.get("/content")
def list_content(db: DbSession, q: Optional[str] = Query(None, max_length=100), limit: int = Query(100, ge=1, le=500),
                 offset: int = Query(0, ge=0)):
    sel = select(Content, User.email, User.full_name).join(User, User.id == Content.user_id)
    if q:
        like = f"%{q.strip().lower()}%"
        sel = sel.where(or_(func.lower(Content.title).like(like), func.lower(User.email).like(like)))
    total = db.scalar(select(func.count()).select_from(sel.subquery())) or 0
    rows = db.execute(sel.order_by(Content.created_at.desc()).limit(limit).offset(offset)).all()
    items = [{"id": str(c.id), "title": c.title, "content_type": c.content_type, "status": c.status,
              "platform": lookup.platform_slug(db, c.platform_id), "category": lookup.category_name(db, c.category_id),
              "language": c.language_code, "owner_email": email, "owner_name": name,
              "created_at": iso(c.created_at)} for c, email, name in rows]
    return {"items": items, "total": total}


@router.delete("/content/{content_id}")
def delete_content(content_id: str, db: DbSession):
    c = db.get(Content, _uuid(content_id))
    if c is None:
        raise NotFoundError()
    notify(db, c.user_id, "Content removed", f'"{c.title}" was removed by a moderator.', "moderation")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ---- editors --------------------------------------------------------------------------------
def _apply_editor(e: EditorProfile, data: dict) -> None:
    skills = data.pop("skills", None)
    for k, v in data.items():
        setattr(e, k, v)
    if skills is not None:
        esvc.set_skills(e, skills)


@router.get("/editors")
def list_editors(db: DbSession, q: Optional[str] = Query(None, max_length=100), status: Optional[str] = Query(None, max_length=20)):
    sel = select(EditorProfile)
    if status:
        sel = sel.where(EditorProfile.status == status)
    if q:
        sel = sel.where(func.lower(EditorProfile.display_name).like(f"%{q.strip().lower()}%"))
    rows = db.scalars(sel.order_by(EditorProfile.display_name)).all()
    return {"items": [esvc.admin_editor_out(e) for e in rows], "total": len(rows)}


@router.post("/editors", status_code=201)
def create_editor(body: AdminEditorIn, db: DbSession):
    if body.user_id is not None:
        if db.get(User, body.user_id) is None:
            raise NotFoundError("That user does not exist.")
        if db.scalar(select(EditorProfile.id).where(EditorProfile.user_id == body.user_id)):
            raise ConflictError("That user already has an editor profile.")
    e = EditorProfile(display_name=body.display_name, specialization=body.specialization, languages=[])
    db.add(e)
    _apply_editor(e, body.model_dump())
    db.commit()
    db.refresh(e)
    return esvc.admin_editor_out(e)


@router.put("/editors/{editor_id}")
def update_editor(editor_id: str, body: AdminEditorUpdate, db: DbSession):
    e = esvc.get_editor(db, editor_id)
    _apply_editor(e, body.model_dump(exclude_unset=True, exclude_none=True))
    db.commit()
    db.refresh(e)
    return esvc.admin_editor_out(e)


@router.delete("/editors/{editor_id}")
def delete_editor(editor_id: str, db: DbSession):
    e = esvc.get_editor(db, editor_id)
    db.delete(e)
    db.commit()
    return {"ok": True}


@router.patch("/editors/{editor_id}/moderation")
def moderate_editor(editor_id: str, body: ModerationIn, db: DbSession):
    e = esvc.get_editor(db, editor_id)
    e.status = body.status
    if body.is_verified is not None:
        e.is_verified = body.is_verified
    if e.user_id and body.status != "active":
        notify(db, e.user_id, "Your editor profile was updated",
               f"Your profile status is now {body.status}.", "moderation", "/app/editor-profile")
    db.commit()
    return esvc.admin_editor_out(e)


# ---- categories -----------------------------------------------------------------------------
def _cat_out(c: Category) -> dict:
    return {"id": c.id, "name": c.name, "slug": c.slug, "description": c.description, "is_active": c.is_active}


def _cat_conflict(db, name: str, slug: str, exclude_id: Optional[int] = None) -> None:
    sel = select(Category.id).where(or_(func.lower(Category.name) == name.lower(), Category.slug == slug))
    if exclude_id is not None:
        sel = sel.where(Category.id != exclude_id)
    if db.scalar(sel):
        raise ConflictError("A category with that name already exists.")


@router.get("/categories")
def list_categories(db: DbSession):
    rows = db.scalars(select(Category).order_by(Category.id)).all()
    return {"items": [_cat_out(c) for c in rows], "total": len(rows)}


@router.post("/categories", status_code=201)
def create_category(body: CategoryIn, db: DbSession):
    slug = slugify(body.name)
    if not slug:
        raise ValidationFailed("Please enter a valid category name.")
    _cat_conflict(db, body.name, slug)
    c = Category(name=body.name, slug=slug, description=body.description, is_active=body.is_active)
    db.add(c)
    db.commit()
    return _cat_out(c)


@router.put("/categories/{category_id}")
def update_category(category_id: int, body: CategoryUpdate, db: DbSession):
    c = db.get(Category, category_id)
    if c is None:
        raise NotFoundError()
    if body.name is not None:
        slug = slugify(body.name)
        _cat_conflict(db, body.name, slug, c.id)
        c.name, c.slug = body.name, slug
    if "description" in body.model_fields_set:
        c.description = body.description
    if body.is_active is not None:
        c.is_active = body.is_active
    db.commit()
    return _cat_out(c)


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: DbSession):
    c = db.get(Category, category_id)
    if c is None:
        raise NotFoundError()
    db.delete(c)
    db.commit()
    return {"ok": True}


# ---- trends ---------------------------------------------------------------------------------
def _trend_out(db, t: Trend) -> dict:
    return {"id": str(t.id), "topic": t.topic, "category": lookup.category_name(db, t.category_id),
            "platform": lookup.platform_slug(db, t.platform_id), "language": t.language_code,
            "trend_score": t.trend_score, "score_breakdown": t.score_breakdown, "growth_pct": t.growth_pct,
            "engagement_rate": t.engagement_rate, "content_count": t.content_count,
            "topic_frequency": t.topic_frequency, "related_topics": t.related_topics, "source": t.source,
            "is_active": t.is_active, "is_sample": t.is_sample, "last_updated": iso(t.last_updated),
            "history": t.history}


def _rescore(t: Trend, recency_days: float) -> None:
    res = compute_trend_score(recency_days, t.growth_pct, t.engagement_rate, t.topic_frequency)
    t.trend_score = res["score"]
    t.score_breakdown = res["breakdown"]
    today = datetime.now(timezone.utc).date().isoformat()
    history = [h for h in (t.history or []) if h.get("date") != today]
    history.append({"date": today, "score": res["score"]})
    t.history = history[-60:]
    t.last_updated = datetime.now(timezone.utc)


def _trend_recency(t: Trend) -> float:
    lu = t.last_updated
    if lu is None:
        return 1.0
    if lu.tzinfo is None:
        lu = lu.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - lu).total_seconds() / 86400)


@router.get("/trends")
def list_trends(db: DbSession, q: Optional[str] = Query(None, max_length=100), limit: int = Query(200, ge=1, le=500)):
    sel = select(Trend)
    if q:
        sel = sel.where(func.lower(Trend.topic).like(f"%{q.strip().lower()}%"))
    rows = db.scalars(sel.order_by(Trend.trend_score.desc()).limit(limit)).all()
    return {"items": [_trend_out(db, t) for t in rows], "total": len(rows)}


@router.post("/trends", status_code=201)
def create_trend(body: TrendAdminIn, db: DbSession):
    t = Trend(topic=body.topic, category_id=resolve_category(db, body.category),
              platform_id=resolve_platform(db, body.platform), language_code=body.language,
              growth_pct=body.growth_pct, engagement_rate=body.engagement_rate, topic_frequency=body.topic_frequency,
              content_count=body.content_count, related_topics=body.related_topics,
              source=body.source or "Admin entry", is_sample=False, is_active=body.is_active, history=[])
    _rescore(t, body.recency_days)
    db.add(t)
    db.commit()
    return _trend_out(db, t)


@router.put("/trends/{trend_id}")
def update_trend(trend_id: str, body: TrendAdminUpdate, db: DbSession):
    t = db.get(Trend, _uuid(trend_id))
    if t is None:
        raise NotFoundError()
    f = body.model_fields_set
    if body.topic is not None:
        t.topic = body.topic
    if "category" in f:
        t.category_id = resolve_category(db, body.category)
    if "platform" in f:
        t.platform_id = resolve_platform(db, body.platform)
    if body.language is not None:
        t.language_code = body.language
    for name in ("growth_pct", "engagement_rate", "topic_frequency", "content_count", "related_topics", "source", "is_active"):
        v = getattr(body, name)
        if v is not None:
            setattr(t, name, v)
    _rescore(t, body.recency_days if body.recency_days is not None else _trend_recency(t))
    db.commit()
    return _trend_out(db, t)


@router.delete("/trends/{trend_id}")
def delete_trend(trend_id: str, db: DbSession):
    t = db.get(Trend, _uuid(trend_id))
    if t is None:
        raise NotFoundError()
    db.delete(t)
    db.commit()
    return {"ok": True}


# ---- reports --------------------------------------------------------------------------------
def _report_out(r: Report, reporter_email: Optional[str] = None) -> dict:
    return {"id": str(r.id), "reporter_id": str(r.reporter_id) if r.reporter_id else None,
            "reporter_email": reporter_email, "target_type": r.target_type, "target_id": str(r.target_id),
            "reason": r.reason, "details": r.details, "status": r.status, "resolution_note": r.resolution_note,
            "created_at": iso(r.created_at), "updated_at": iso(r.updated_at)}


@router.get("/reports")
def list_reports(db: DbSession, status: Optional[str] = Query(None, max_length=20)):
    sel = select(Report, User.email).outerjoin(User, User.id == Report.reporter_id)
    if status:
        sel = sel.where(Report.status == status)
    rows = db.execute(sel.order_by(Report.created_at.desc())).all()
    return {"items": [_report_out(r, email) for r, email in rows], "total": len(rows)}


@router.patch("/reports/{report_id}")
def update_report(report_id: str, body: ReportUpdateIn, admin: AdminUser, db: DbSession):
    r = db.get(Report, _uuid(report_id))
    if r is None:
        raise NotFoundError()
    r.status = body.status
    if body.resolution_note is not None:
        r.resolution_note = body.resolution_note
    r.resolved_by = admin.id if body.status in ("resolved", "dismissed") else None
    db.commit()
    return _report_out(r)


# ---- AI usage -------------------------------------------------------------------------------
@router.get("/ai-usage")
def ai_usage(db: DbSession, days: int = Query(30, ge=1, le=365)):
    since = _since(days)
    base = AIRequest.created_at >= since
    total = db.scalar(select(func.count()).select_from(AIRequest).where(base)) or 0
    by_feature = db.execute(select(AIRequest.feature, func.count()).where(base).group_by(AIRequest.feature)
                            .order_by(func.count().desc())).all()
    by_status = db.execute(select(AIRequest.status, func.count()).where(base).group_by(AIRequest.status)).all()
    day = func.date(AIRequest.created_at)
    by_day = db.execute(select(day, func.count()).where(base).group_by(day).order_by(day)).all()
    sample = sum(n for s, n in by_status if s == "sample")
    avg_latency = db.scalar(select(func.avg(AIRequest.latency_ms)).where(base, AIRequest.latency_ms.is_not(None)))
    top = db.execute(select(User.id, User.email, User.full_name, func.count().label("n"))
                     .select_from(AIRequest).join(User, User.id == AIRequest.user_id).where(base)
                     .group_by(User.id, User.email, User.full_name).order_by(func.count().desc()).limit(5)).all()
    return {
        "total": total,
        "by_feature": [{"feature": f, "count": n} for f, n in by_feature],
        "by_day": [{"date": str(d), "count": n} for d, n in by_day],
        "by_status": [{"status": s, "count": n} for s, n in by_status],
        "sample_share": round(sample / total, 3) if total else 0.0,
        "avg_latency_ms": round(float(avg_latency), 1) if avg_latency is not None else 0.0,
        "top_users": [{"user_id": str(i), "email": e, "full_name": n, "count": c} for i, e, n, c in top],
    }


# ---- settings -------------------------------------------------------------------------------
SETTING_DEFAULTS = {"open_registration": True, "ai_daily_limit_per_user": 200, "announcement": ""}


def _read_settings(db) -> dict:
    out = dict(SETTING_DEFAULTS)
    for row in db.scalars(select(PlatformSetting)):
        if row.key in out:
            out[row.key] = row.value.get("value") if isinstance(row.value, dict) else row.value
    return out


@router.get("/settings")
def get_platform_settings(db: DbSession):
    return _read_settings(db)


@router.put("/settings")
def put_platform_settings(body: SettingsIn, db: DbSession):
    for key, value in body.model_dump(exclude_none=True).items():
        row = db.get(PlatformSetting, key)
        if row is None:
            db.add(PlatformSetting(key=key, value={"value": value}))
        else:
            row.value = {"value": value}
    db.commit()
    return _read_settings(db)
