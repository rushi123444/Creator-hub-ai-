"""Recommendation routes (rule-based, analytical wording)."""
from __future__ import annotations

from fastapi import APIRouter

from app.errors import NotFoundError
from app.routers.deps import CurrentUser, DbSession
from app.services import recommendation_service as svc

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("")
def list_recommendations(user: CurrentUser, db: DbSession):
    items = svc.list_recommendations(db, user)
    return {"items": items, "total": len(items)}


@router.post("/generate")
def generate(user: CurrentUser, db: DbSession):
    items = svc.generate_recommendations(db, user)
    return {"items": items, "total": len(items)}


@router.post("/{rec_id}/dismiss")
def dismiss(rec_id: str, user: CurrentUser, db: DbSession):
    out = svc.dismiss_recommendation(db, user, rec_id)
    if out is None:
        raise NotFoundError()
    return out
