import uuid

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.errors import NotFoundError
from app.models.system import Notification
from app.routers.deps import CurrentUser, DbSession
from app.services.notification_service import mark_all_read, notification_out

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: CurrentUser, db: DbSession, limit: int = Query(50, ge=1, le=200)):
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id)
                      .order_by(Notification.created_at.desc()).limit(limit)).all()
    unread = db.scalar(select(func.count()).select_from(Notification)
                       .where(Notification.user_id == user.id, Notification.is_read.is_(False))) or 0
    return {"items": [notification_out(n) for n in rows], "total": len(rows), "unread": unread}


@router.post("/read-all")
def read_all(user: CurrentUser, db: DbSession):
    return {"ok": True, "updated": mark_all_read(db, user.id)}


@router.post("/{notification_id}/read")
def read_one(notification_id: str, user: CurrentUser, db: DbSession):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise NotFoundError()
    n = db.scalar(select(Notification).where(Notification.id == nid, Notification.user_id == user.id))
    if n is None:
        raise NotFoundError()
    n.is_read = True
    db.commit()
    return notification_out(n)
