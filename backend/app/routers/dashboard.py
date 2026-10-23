"""Dashboard route."""
from __future__ import annotations

from fastapi import APIRouter

from app.routers.deps import CurrentUser, DbSession
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import build_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def dashboard(user: CurrentUser, db: DbSession):
    return build_dashboard(db, user)
