"""Content + calendar business logic (ownership-scoped, calendar/content status sync)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import NotFoundError, ValidationFailed
from app.models.content import Content, ContentCalendar
from app.schemas.common import ensure_utc, iso
from app.services import lookup


def get_owned_content(db: Session, user_id, content_id) -> Content:
    try:
        cid = content_id if isinstance(content_id, uuid.UUID) else uuid.UUID(str(content_id))
    except ValueError:
        raise NotFoundError()
    row = db.scalar(select(Content).where(Content.id == cid, Content.user_id == user_id))
    if row is None:
        raise NotFoundError()
    return row


def get_owned_calendar(db: Session, user_id, cal_id) -> ContentCalendar:
    try:
        cid = cal_id if isinstance(cal_id, uuid.UUID) else uuid.UUID(str(cal_id))
    except ValueError:
        raise NotFoundError()
    row = db.scalar(select(ContentCalendar).where(ContentCalendar.id == cid, ContentCalendar.user_id == user_id))
    if row is None:
        raise NotFoundError()
    return row


def content_out(db: Session, c: Content) -> dict:
    return {
        "id": str(c.id), "title": c.title, "topic": c.topic, "content_type": c.content_type,
        "platform": lookup.platform_slug(db, c.platform_id), "category": lookup.category_name(db, c.category_id),
        "language": c.language_code, "status": c.status, "body": c.body, "caption": c.caption,
        "hashtags": list(c.hashtags or []), "notes": c.notes, "ai_generated": c.ai_generated,
        "scheduled_at": iso(c.scheduled_at), "published_at": iso(c.published_at),
        "created_at": iso(c.created_at), "updated_at": iso(c.updated_at),
    }


def calendar_out(db: Session, e: ContentCalendar) -> dict:
    return {
        "id": str(e.id), "content_id": str(e.content_id) if e.content_id else None, "title": e.title,
        "platform": lookup.platform_slug(db, e.platform_id), "status": e.status,
        "scheduled_at": iso(e.scheduled_at), "notes": e.notes,
        "created_at": iso(e.created_at), "updated_at": iso(e.updated_at),
    }


def _resolve_platform(db: Session, ref) -> Optional[int]:
    if ref in (None, ""):
        return None
    pid = lookup.platform_id(db, ref)
    if pid is None:
        raise ValidationFailed("Please choose a valid platform.", fields={"platform": "Unknown platform"})
    return pid


def _resolve_category(db: Session, ref) -> Optional[int]:
    if ref in (None, ""):
        return None
    cid = lookup.category_id(db, ref)
    if cid is None:
        raise ValidationFailed("Please choose a valid category.", fields={"category": "Unknown category"})
    return cid


def resolve_platform(db, ref):
    return _resolve_platform(db, ref)


def resolve_category(db, ref):
    return _resolve_category(db, ref)


def _apply_status_side_effects(c: Content, status: str) -> None:
    if status == "published" and c.published_at is None:
        c.published_at = datetime.now(timezone.utc)
    if status != "published":
        c.published_at = None if status in ("idea", "draft", "script", "recording", "editing", "scheduled") else c.published_at


def create_content(db: Session, user_id, data) -> Content:
    c = Content(
        user_id=user_id, title=data.title, topic=data.topic, content_type=data.content_type,
        platform_id=_resolve_platform(db, data.platform), category_id=_resolve_category(db, data.category),
        language_code=data.language or "en", status=data.status, body=data.body, caption=data.caption,
        hashtags=data.hashtags or [], notes=data.notes, ai_generated=data.ai_generated,
        scheduled_at=ensure_utc(data.scheduled_at),
    )
    _apply_status_side_effects(c, data.status)
    db.add(c)
    db.flush()
    if c.scheduled_at is not None:
        sync_calendar_from_content(db, c)
    db.commit()
    return c


def update_content(db: Session, c: Content, data) -> Content:
    fields = data.model_fields_set
    if "title" in fields and data.title is not None:
        c.title = data.title
    for f in ("topic", "content_type", "body", "caption", "notes"):
        if f in fields and (getattr(data, f) is not None or f in ("topic", "body", "caption", "notes")):
            setattr(c, f, getattr(data, f))
    if "platform" in fields:
        c.platform_id = _resolve_platform(db, data.platform)
    if "category" in fields:
        c.category_id = _resolve_category(db, data.category)
    if "language" in fields and data.language:
        c.language_code = data.language
    if "hashtags" in fields and data.hashtags is not None:
        c.hashtags = data.hashtags
    if "ai_generated" in fields and data.ai_generated is not None:
        c.ai_generated = data.ai_generated
    if "scheduled_at" in fields:
        c.scheduled_at = ensure_utc(data.scheduled_at)
    if "status" in fields and data.status:
        c.status = data.status
        _apply_status_side_effects(c, data.status)
        for e in db.scalars(select(ContentCalendar).where(ContentCalendar.content_id == c.id,
                                                          ContentCalendar.user_id == c.user_id)):
            e.status = data.status
    if c.scheduled_at is not None and ("scheduled_at" in fields or "platform" in fields or "title" in fields):
        sync_calendar_from_content(db, c)
    db.commit()
    return c


def sync_calendar_from_content(db: Session, c: Content) -> Optional[ContentCalendar]:
    """Create or update the calendar row linked to this content."""
    if c.scheduled_at is None:
        return None
    entry = db.scalar(select(ContentCalendar).where(ContentCalendar.content_id == c.id,
                                                    ContentCalendar.user_id == c.user_id))
    if entry is None:
        entry = ContentCalendar(user_id=c.user_id, content_id=c.id, title=c.title, platform_id=c.platform_id,
                                status=c.status, scheduled_at=c.scheduled_at)
        db.add(entry)
    else:
        entry.title, entry.platform_id, entry.status, entry.scheduled_at = c.title, c.platform_id, c.status, c.scheduled_at
    db.flush()
    return entry


def schedule_content(db: Session, c: Content, scheduled_at: datetime, platform_ref=None) -> tuple[Content, ContentCalendar]:
    if platform_ref not in (None, ""):
        c.platform_id = _resolve_platform(db, platform_ref)
    c.scheduled_at = ensure_utc(scheduled_at)
    if c.status != "published":
        c.status = "scheduled"
    entry = sync_calendar_from_content(db, c)
    db.commit()
    return c, entry


def duplicate_content(db: Session, c: Content) -> Content:
    copy = Content(
        user_id=c.user_id, title=(f"{c.title} (copy)")[:200], topic=c.topic, content_type=c.content_type,
        platform_id=c.platform_id, category_id=c.category_id, language_code=c.language_code, status="draft",
        body=c.body, caption=c.caption, hashtags=list(c.hashtags or []), notes=c.notes,
        ai_generated=c.ai_generated,
    )
    db.add(copy)
    db.commit()
    return copy


def create_calendar_entry(db: Session, user_id, data) -> ContentCalendar:
    title = data.title
    platform_id = _resolve_platform(db, data.platform)
    content = None
    if data.content_id:
        content = get_owned_content(db, user_id, data.content_id)
        title = title or content.title
        platform_id = platform_id or content.platform_id
    if not title:
        raise ValidationFailed("Please enter a title.", fields={"title": "Required"})
    entry = ContentCalendar(user_id=user_id, content_id=content.id if content else None, title=title,
                            platform_id=platform_id, status=data.status, scheduled_at=ensure_utc(data.scheduled_at),
                            notes=data.notes)
    db.add(entry)
    if content is not None:
        content.scheduled_at = entry.scheduled_at
        content.status = data.status
        _apply_status_side_effects(content, data.status)
    db.commit()
    return entry


def update_calendar_entry(db: Session, user_id, e: ContentCalendar, data) -> ContentCalendar:
    f = data.model_fields_set
    if "title" in f and data.title:
        e.title = data.title
    if "platform" in f:
        e.platform_id = _resolve_platform(db, data.platform)
    if "notes" in f:
        e.notes = data.notes
    if "content_id" in f:
        e.content_id = get_owned_content(db, user_id, data.content_id).id if data.content_id else None
    if "scheduled_at" in f and data.scheduled_at:
        e.scheduled_at = ensure_utc(data.scheduled_at)
    if "status" in f and data.status:
        e.status = data.status
    _sync_content_from_calendar(db, e, status="status" in f and bool(data.status), when="scheduled_at" in f)
    db.commit()
    return e


def _sync_content_from_calendar(db: Session, e: ContentCalendar, status: bool = False, when: bool = False) -> None:
    if not e.content_id:
        return
    c = db.scalar(select(Content).where(Content.id == e.content_id, Content.user_id == e.user_id))
    if c is None:
        return
    if status:
        c.status = e.status
        _apply_status_side_effects(c, e.status)
    if when:
        c.scheduled_at = e.scheduled_at


def move_calendar_entry(db: Session, e: ContentCalendar, scheduled_at: datetime) -> ContentCalendar:
    e.scheduled_at = ensure_utc(scheduled_at)
    _sync_content_from_calendar(db, e, when=True)
    db.commit()
    return e


def set_calendar_status(db: Session, e: ContentCalendar, status: str) -> ContentCalendar:
    e.status = status
    _sync_content_from_calendar(db, e, status=True)
    db.commit()
    return e
