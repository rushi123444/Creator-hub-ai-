"""Analytics routes. Every query is scoped to the signed-in user."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query

from app.analytics import aggregation as agg
from app.analytics.analyzer import analyze
from app.errors import NotFoundError, ValidationFailed
from app.models.insights import AnalyticsEntry
from app.routers.deps import CurrentUser, DbSession
from app.schemas.analytics import AnalyzeRequest, EntryCreate, EntryUpdate
from app.services import lookup

router = APIRouter(prefix="/analytics", tags=["analytics"])
DATE_ORDER_MSG = "The start date must be on or before the end date."


def _resolve(db, data: dict) -> dict:
    """Translate slug/name inputs into ids; reject unknown values with a friendly message."""
    out = {k: v for k, v in data.items() if k not in ("platform", "category", "language", "content_id")}
    if data.get("platform"):
        pid = lookup.platform_id(db, data["platform"])
        if pid is None:
            raise ValidationFailed("Choose a valid platform.", {"platform": "Choose a valid platform."})
        out["platform_id"] = pid
    if data.get("category"):
        cid = lookup.category_id(db, data["category"])
        if cid is None:
            raise ValidationFailed("Choose a valid category.", {"category": "Choose a valid category."})
        out["category_id"] = cid
    if data.get("language"):
        code = lookup.language_code(data["language"])
        if code is None:
            raise ValidationFailed("Choose English, Hindi or Marathi.", {"language": "Choose a valid language."})
        out["language_code"] = code
    if data.get("content_id"):
        try:
            out["content_id"] = uuid.UUID(data["content_id"])
        except ValueError:
            raise ValidationFailed("Invalid content link.", {"content_id": "Invalid content link."})
    return out


def _owned(db, user, entry_id: str) -> AnalyticsEntry:
    try:
        eid = uuid.UUID(entry_id)
    except ValueError:
        raise NotFoundError()
    entry = db.get(AnalyticsEntry, eid)
    if entry is None or entry.user_id != user.id:
        raise NotFoundError()
    return entry


def _check_range(start: Optional[date], end: Optional[date]) -> None:
    if start and end and start > end:
        raise ValidationFailed(DATE_ORDER_MSG, {"start": DATE_ORDER_MSG})


@router.get("/summary")
def summary(user: CurrentUser, db: DbSession, start: Optional[date] = None, end: Optional[date] = None,
            platform: Optional[str] = Query(None, max_length=40), category: Optional[str] = Query(None, max_length=80),
            language: Optional[str] = Query(None, max_length=10)):
    _check_range(start, end)
    rows = agg.load_entries(db, user.id, start=start, end=end, platform=platform, category=category, language=language)
    return agg.summarize(db, rows)


@router.get("/entries")
def list_entries(user: CurrentUser, db: DbSession, start: Optional[date] = None, end: Optional[date] = None,
                 platform: Optional[str] = Query(None, max_length=40), category: Optional[str] = Query(None, max_length=80),
                 language: Optional[str] = Query(None, max_length=10), limit: int = Query(100, ge=1, le=500),
                 offset: int = Query(0, ge=0)):
    _check_range(start, end)
    rows = agg.load_entries(db, user.id, start=start, end=end, platform=platform, category=category, language=language)
    rows.reverse()  # newest first
    names = agg.Names(db)
    return {"items": [agg.entry_out(names, r) for r in rows[offset: offset + limit]], "total": len(rows)}


@router.post("/entries", status_code=201)
def create_entry(body: EntryCreate, user: CurrentUser, db: DbSession):
    data = _resolve(db, body.model_dump(exclude_unset=True))
    data.setdefault("recorded_on", datetime.now(timezone.utc).date())
    entry = AnalyticsEntry(user_id=user.id, **data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return agg.entry_out(agg.Names(db), entry)


@router.put("/entries/{entry_id}")
def update_entry(entry_id: str, body: EntryUpdate, user: CurrentUser, db: DbSession):
    entry = _owned(db, user, entry_id)
    for key, value in _resolve(db, body.model_dump(exclude_unset=True)).items():
        if value is None and key in ("title", "views", "likes", "comments", "shares", "saves", "recorded_on",
                                     "watch_time_minutes", "followers_gained"):
            continue
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return agg.entry_out(agg.Names(db), entry)


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: str, user: CurrentUser, db: DbSession):
    db.delete(_owned(db, user, entry_id))
    db.commit()
    return {"ok": True}


@router.post("/analyze")
def analyze_content(body: AnalyzeRequest, user: CurrentUser):
    return analyze(**body.model_dump())
