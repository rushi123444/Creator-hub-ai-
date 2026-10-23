from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.errors import ValidationFailed
from app.models.content import ContentCalendar
from app.routers.deps import CurrentUser, DbSession
from app.schemas.content import CalendarCreate, CalendarMoveIn, CalendarStatusIn, CalendarUpdate
from app.services import content_service as svc

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _parse(value: Optional[str], end: bool = False) -> Optional[datetime]:
    if not value:
        return None
    try:
        if len(value) == 10:
            d = date.fromisoformat(value)
            return datetime.combine(d, time.max if end else time.min, tzinfo=timezone.utc)
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise ValidationFailed("Please use dates like 2026-10-01.", fields={"date": "Invalid date"})


@router.get("")
def list_calendar(user: CurrentUser, db: DbSession, start: Optional[str] = None, end: Optional[str] = None):
    sel = select(ContentCalendar).where(ContentCalendar.user_id == user.id)
    s, e = _parse(start), _parse(end, True)
    if s:
        sel = sel.where(ContentCalendar.scheduled_at >= s)
    if e:
        sel = sel.where(ContentCalendar.scheduled_at <= e)
    rows = db.scalars(sel.order_by(ContentCalendar.scheduled_at)).all()
    return {"items": [svc.calendar_out(db, r) for r in rows], "total": len(rows)}


@router.post("", status_code=201)
def create(body: CalendarCreate, user: CurrentUser, db: DbSession):
    return svc.calendar_out(db, svc.create_calendar_entry(db, user.id, body))


@router.put("/{entry_id}")
def update(entry_id: str, body: CalendarUpdate, user: CurrentUser, db: DbSession):
    e = svc.get_owned_calendar(db, user.id, entry_id)
    return svc.calendar_out(db, svc.update_calendar_entry(db, user.id, e, body))


@router.delete("/{entry_id}")
def delete(entry_id: str, user: CurrentUser, db: DbSession):
    e = svc.get_owned_calendar(db, user.id, entry_id)
    db.delete(e)
    db.commit()
    return {"ok": True}


@router.post("/{entry_id}/move")
def move(entry_id: str, body: CalendarMoveIn, user: CurrentUser, db: DbSession):
    e = svc.get_owned_calendar(db, user.id, entry_id)
    return svc.calendar_out(db, svc.move_calendar_entry(db, e, body.scheduled_at))


@router.patch("/{entry_id}/status")
def set_status(entry_id: str, body: CalendarStatusIn, user: CurrentUser, db: DbSession):
    e = svc.get_owned_calendar(db, user.id, entry_id)
    return svc.calendar_out(db, svc.set_calendar_status(db, e, body.status))
