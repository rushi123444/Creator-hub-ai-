"""Competitor / public analysis routes (public information only)."""
from __future__ import annotations

from pydantic import Field

from fastapi import APIRouter

from app.errors import NotFoundError
from app.routers.deps import CurrentUser, DbSession
from app.schemas.common import StrictModel
from app.services import competitor_service as svc

router = APIRouter(prefix="/competitors", tags=["competitors"])


class AnalyzeIn(StrictModel):
    platform: str = Field(default="youtube", min_length=1, max_length=40)
    handle_or_url: str = Field(min_length=2, max_length=500)


@router.post("/analyze")
def analyze(body: AnalyzeIn, user: CurrentUser, db: DbSession):
    return svc.analyze_competitor(db, user, body.platform, body.handle_or_url)


@router.get("")
def list_all(user: CurrentUser, db: DbSession):
    items = svc.list_competitors(db, user)
    return {"items": items, "total": len(items)}


@router.get("/{competitor_id}")
def get_one(competitor_id: str, user: CurrentUser, db: DbSession):
    row = svc.get_owned(db, user, competitor_id)
    if row is None:
        raise NotFoundError()
    return svc.competitor_out(db, row)


@router.delete("/{competitor_id}")
def delete(competitor_id: str, user: CurrentUser, db: DbSession):
    row = svc.get_owned(db, user, competitor_id)
    if row is None:
        raise NotFoundError()
    db.delete(row)
    db.commit()
    return {"ok": True}
