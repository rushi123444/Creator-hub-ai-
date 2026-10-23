"""Analytics request schemas (responses are plain dicts shaped per the contract)."""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import Field

from app.schemas.common import StrictModel, Text200

Count = Field(default=0, ge=0, le=2_000_000_000)


class EntryBase(StrictModel):
    topic: Optional[Text200] = None
    platform: Optional[str] = Field(default=None, max_length=40)
    category: Optional[str] = Field(default=None, max_length=80)
    language: Optional[str] = Field(default=None, max_length=10)
    recorded_on: Optional[date] = None
    publication_date: Optional[date] = None
    duration_seconds: Optional[int] = Field(default=None, ge=0, le=86400)
    reach: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)
    content_id: Optional[str] = Field(default=None, max_length=40)


class EntryCreate(EntryBase):
    title: Text200 = Field(min_length=1)
    views: int = Count
    likes: int = Count
    comments: int = Count
    shares: int = Count
    saves: int = Count
    watch_time_minutes: float = Field(default=0, ge=0, le=1e9)
    followers_gained: int = Field(default=0, ge=0, le=2_000_000_000)


class EntryUpdate(EntryBase):
    title: Optional[Text200] = Field(default=None, min_length=1)
    views: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)
    likes: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)
    comments: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)
    shares: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)
    saves: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)
    watch_time_minutes: Optional[float] = Field(default=None, ge=0, le=1e9)
    followers_gained: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)


class AnalyzeRequest(StrictModel):
    title: Text200 = Field(min_length=1)
    topic: Optional[Text200] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    duration_seconds: Optional[int] = Field(default=None, ge=0, le=86400)
    category: Optional[str] = Field(default=None, max_length=80)
    language: Optional[str] = Field(default=None, max_length=10)
    views: int = Count
    likes: int = Count
    comments: int = Count
    shares: int = Count
    saves: int = Count
    publication_date: Optional[date] = None
    reach: Optional[int] = Field(default=None, ge=0, le=2_000_000_000)
