"""Content, calendar, saved items (ideas/hooks/captions/hashtags/scripts) schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.common import (
    ContentStatus, ContentType, HookType, StrictModel, clean_str_list,
)

PlatformRef = Optional[Union[str, int]]
Lang = Optional[Literal["en", "hi", "mr"]]


def _tags(v):
    if v is None:
        return v
    cleaned = clean_str_list(v, max_items=60, max_len=100)
    return [t if t.startswith("#") else f"#{t}" for t in cleaned]


class ContentCreate(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    topic: Optional[str] = Field(default=None, max_length=200)
    content_type: ContentType = "reel"
    platform: PlatformRef = None
    category: PlatformRef = None
    language: Lang = None
    status: ContentStatus = "draft"
    body: Optional[str] = Field(default=None, max_length=20000)
    caption: Optional[str] = Field(default=None, max_length=5000)
    hashtags: Optional[list[str]] = None
    notes: Optional[str] = Field(default=None, max_length=5000)
    ai_generated: bool = False
    scheduled_at: Optional[datetime] = None

    _norm_tags = field_validator("hashtags")(_tags)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Please enter a title")
        return v


class ContentUpdate(StrictModel):
    """Partial update: only supplied fields change."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    topic: Optional[str] = Field(default=None, max_length=200)
    content_type: Optional[ContentType] = None
    platform: PlatformRef = None
    category: PlatformRef = None
    language: Lang = None
    status: Optional[ContentStatus] = None
    body: Optional[str] = Field(default=None, max_length=20000)
    caption: Optional[str] = Field(default=None, max_length=5000)
    hashtags: Optional[list[str]] = None
    notes: Optional[str] = Field(default=None, max_length=5000)
    ai_generated: Optional[bool] = None
    scheduled_at: Optional[datetime] = None

    _norm_tags = field_validator("hashtags")(_tags)


class ScheduleIn(StrictModel):
    scheduled_at: datetime
    platform: PlatformRef = None


class CalendarCreate(StrictModel):
    title: Optional[str] = Field(default=None, max_length=200)
    content_id: Optional[UUID] = None
    platform: PlatformRef = None
    status: ContentStatus = "scheduled"
    scheduled_at: datetime
    notes: Optional[str] = Field(default=None, max_length=5000)


class CalendarUpdate(StrictModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content_id: Optional[UUID] = None
    platform: PlatformRef = None
    status: Optional[ContentStatus] = None
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=5000)


class CalendarMoveIn(StrictModel):
    scheduled_at: datetime


class CalendarStatusIn(StrictModel):
    status: ContentStatus


# ---- saved AI output -----------------------------------------------------------------------
class IdeaIn(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    topic: Optional[str] = Field(default=None, max_length=200)
    format: Optional[str] = Field(default=None, max_length=60)
    reason: Optional[str] = Field(default=None, max_length=2000)
    suggested_hook: Optional[str] = Field(default=None, max_length=2000)
    category: PlatformRef = None
    platform: PlatformRef = None
    language: Lang = None


class HookIn(StrictModel):
    hook_type: HookType
    text: str = Field(min_length=1, max_length=2000)
    topic: Optional[str] = Field(default=None, max_length=200)
    content_id: Optional[UUID] = None
    platform: PlatformRef = None
    language: Lang = None


class CaptionIn(StrictModel):
    instagram_caption: Optional[str] = Field(default=None, max_length=5000)
    youtube_description: Optional[str] = Field(default=None, max_length=5000)
    short_description: Optional[str] = Field(default=None, max_length=2000)
    cta: Optional[str] = Field(default=None, max_length=1000)
    keywords: list[str] = Field(default_factory=list)
    topic: Optional[str] = Field(default=None, max_length=200)
    content_id: Optional[UUID] = None
    platform: PlatformRef = None
    language: Lang = None

    @field_validator("keywords")
    @classmethod
    def _kw(cls, v):
        return clean_str_list(v, max_items=40, max_len=80)

    @field_validator("instagram_caption", "youtube_description", "short_description")
    @classmethod
    def _nonempty(cls, v):
        return v


class HashtagIn(StrictModel):
    broad: list[str] = Field(default_factory=list)
    medium: list[str] = Field(default_factory=list)
    niche: list[str] = Field(default_factory=list)
    topic: Optional[str] = Field(default=None, max_length=200)
    content_id: Optional[UUID] = None
    platform: PlatformRef = None
    language: Lang = None

    @field_validator("broad", "medium", "niche")
    @classmethod
    def _tags_ok(cls, v):
        return clean_str_list(v, max_items=40, max_len=100)


class ScriptIn(StrictModel):
    topic: Optional[str] = Field(default=None, max_length=200)
    hook: Optional[str] = Field(default=None, max_length=2000)
    introduction: Optional[str] = Field(default=None, max_length=5000)
    main_points: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)
    cta: Optional[str] = Field(default=None, max_length=2000)
    ending: Optional[str] = Field(default=None, max_length=2000)
    full_script: Optional[str] = Field(default=None, max_length=20000)
    content_id: Optional[UUID] = None
    platform: PlatformRef = None
    language: Lang = None
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=36000)
    tone: Optional[str] = Field(default=None, max_length=30)

    @field_validator("main_points", "examples")
    @classmethod
    def _lists(cls, v):
        return clean_str_list(v, max_items=30, max_len=2000)


class ScriptToContentIn(StrictModel):
    title: Optional[str] = Field(default=None, max_length=200)
    content_type: ContentType = "reel"
