"""Trend response schemas."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class TrendOut(BaseModel):
    id: str
    topic: str
    category: Optional[str] = None
    platform: Optional[str] = None
    language: str
    trend_score: float
    score_breakdown: dict[str, float]
    growth_pct: float
    engagement_rate: float
    content_count: int
    related_topics: list[str]
    source: str
    last_updated: Optional[str] = None
    is_sample: bool
    history: list[dict[str, Any]] = []


class TrendsResponse(BaseModel):
    items: list[TrendOut]
    charts: dict[str, list[dict[str, Any]]]
    source: str
    note: Optional[str] = None
    score_definition: str


class RefreshResponse(BaseModel):
    source: str
    updated: int
    note: Optional[str] = None
