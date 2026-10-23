"""Trend routes. Live data is optional; failures fall back to sample data with a friendly note."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Query

from app.errors import NotFoundError
from app.models.insights import Trend
from app.routers.deps import CurrentUser, DbSession
from app.schemas.trends import RefreshResponse, TrendOut, TrendsResponse
from app.trends import service

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("", response_model=TrendsResponse)
def list_trends(
    user: CurrentUser, db: DbSession,
    platform: Optional[str] = Query(None, max_length=40), category: Optional[str] = Query(None, max_length=80),
    language: Optional[str] = Query(None, max_length=10), days: Optional[int] = Query(None, ge=1, le=365),
    q: Optional[str] = Query(None, max_length=100), sort: str = Query("score", pattern="^(score|growth|engagement)$"),
    limit: int = Query(50, ge=1, le=200),
):
    if db.query(Trend.id).first() is None:  # empty DB: show sample insights
        service.seed_sample_trends(db)
    return service.list_trends_response(db, platform=platform, category=category, language=language, days=days,
                                        q=q, sort=sort, limit=limit)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(user: CurrentUser, db: DbSession):
    return service.refresh_trends(db)


@router.get("/{trend_id}", response_model=TrendOut)
def get_trend(trend_id: str, user: CurrentUser, db: DbSession):
    try:
        tid = uuid.UUID(trend_id)
    except ValueError:
        raise NotFoundError("We could not find that trend.")
    trend = db.get(Trend, tid)
    if trend is None or not trend.is_active:
        raise NotFoundError("We could not find that trend.")
    return service.trend_out(db, trend)
