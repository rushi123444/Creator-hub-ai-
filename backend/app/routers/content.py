from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.models.content import Content
from app.routers.deps import CurrentUser, DbSession
from app.schemas.common import CONTENT_STATUSES
from app.schemas.content import ContentCreate, ContentUpdate, ScheduleIn
from app.services import content_service as svc, lookup

router = APIRouter(prefix="/content", tags=["content"])


@router.get("")
def list_content(user: CurrentUser, db: DbSession, status: Optional[str] = None, q: Optional[str] = Query(None, max_length=100),
                 platform: Optional[str] = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    base = select(Content).where(Content.user_id == user.id)
    if platform:
        base = base.where(Content.platform_id == (lookup.platform_id(db, platform) or -1))
    if q:
        like = f"%{q.strip().lower()}%"
        base = base.where(or_(func.lower(Content.title).like(like), func.lower(func.coalesce(Content.topic, "")).like(like)))
    counts = {"all": 0, **{s: 0 for s in CONTENT_STATUSES}}
    rows = db.execute(select(Content.status, func.count()).where(Content.id.in_(base.with_only_columns(Content.id)))
                      .group_by(Content.status)).all()
    for s, n in rows:
        counts[s] = n
        counts["all"] += n
    sel = base
    if status:
        sel = sel.where(Content.status == status)
    total = db.scalar(select(func.count()).select_from(sel.subquery())) or 0
    items = db.scalars(sel.order_by(Content.updated_at.desc()).limit(limit).offset(offset)).all()
    return {"items": [svc.content_out(db, c) for c in items], "total": total, "counts": counts}


@router.post("", status_code=201)
def create(body: ContentCreate, user: CurrentUser, db: DbSession):
    return svc.content_out(db, svc.create_content(db, user.id, body))


@router.get("/{content_id}")
def get_one(content_id: str, user: CurrentUser, db: DbSession):
    return svc.content_out(db, svc.get_owned_content(db, user.id, content_id))


@router.put("/{content_id}")
def update(content_id: str, body: ContentUpdate, user: CurrentUser, db: DbSession):
    c = svc.get_owned_content(db, user.id, content_id)
    return svc.content_out(db, svc.update_content(db, c, body))


@router.delete("/{content_id}")
def delete(content_id: str, user: CurrentUser, db: DbSession):
    c = svc.get_owned_content(db, user.id, content_id)
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.post("/{content_id}/duplicate", status_code=201)
def duplicate(content_id: str, user: CurrentUser, db: DbSession):
    c = svc.get_owned_content(db, user.id, content_id)
    return svc.content_out(db, svc.duplicate_content(db, c))


@router.post("/{content_id}/schedule")
def schedule(content_id: str, body: ScheduleIn, user: CurrentUser, db: DbSession):
    c = svc.get_owned_content(db, user.id, content_id)
    c, entry = svc.schedule_content(db, c, body.scheduled_at, body.platform)
    return {**svc.content_out(db, c), "calendar_entry": svc.calendar_out(db, entry)}
