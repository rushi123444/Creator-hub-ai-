"""Dashboard response schema (contract section 5)."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_views: int
    engagement_rate: float
    saved_ideas: int
    scheduled_posts: int
    ai_generations: int


class DashboardResponse(BaseModel):
    greeting_name: str
    stats: DashboardStats
    trending: list[dict[str, Any]]
    recent_content: list[dict[str, Any]]
    upcoming: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]
    charts: dict[str, list[dict[str, Any]]]
    is_sample_data: bool
    engagement_label: Optional[str] = None
