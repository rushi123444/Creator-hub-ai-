"""Editor directory, reports, notifications and admin schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional, Union
from uuid import UUID

from pydantic import EmailStr, Field, field_validator, model_validator

from app.schemas.common import (
    LANGUAGES, Specialization, StrictModel, clean_str_list, validate_url,
)


class EditorBase(StrictModel):
    display_name: str = Field(min_length=1, max_length=120)
    headline: Optional[str] = Field(default=None, max_length=160)
    specialization: Specialization
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    experience_years: int = Field(default=0, ge=0, le=60)
    portfolio_url: Optional[str] = None
    instagram_url: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("skills")
    @classmethod
    def _skills(cls, v):
        return clean_str_list(v, max_items=20, max_len=60)

    @field_validator("languages")
    @classmethod
    def _langs(cls, v):
        out = clean_str_list([x.lower() for x in v], max_items=3, max_len=5)
        bad = [x for x in out if x not in LANGUAGES]
        if bad:
            raise ValueError("Languages must be en, hi or mr")
        return out

    @field_validator("portfolio_url", "instagram_url", "avatar_url")
    @classmethod
    def _urls(cls, v):
        return validate_url(v)

    @field_validator("display_name")
    @classmethod
    def _dn(cls, v):
        if not v.strip():
            raise ValueError("Please enter a display name")
        return v


class EditorSelfIn(EditorBase):
    """Editor self-service. Verification / moderation fields are admin-only and ignored here."""


class AdminEditorIn(EditorBase):
    user_id: Optional[UUID] = None
    is_verified: bool = False
    status: Literal["active", "flagged", "suspended"] = "active"


class AdminEditorUpdate(StrictModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    headline: Optional[str] = Field(default=None, max_length=160)
    specialization: Optional[Specialization] = None
    skills: Optional[list[str]] = None
    languages: Optional[list[str]] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=60)
    portfolio_url: Optional[str] = None
    instagram_url: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=2000)
    is_verified: Optional[bool] = None
    status: Optional[Literal["active", "flagged", "suspended"]] = None

    @field_validator("skills")
    @classmethod
    def _skills(cls, v):
        return None if v is None else clean_str_list(v, max_items=20, max_len=60)

    @field_validator("languages")
    @classmethod
    def _langs(cls, v):
        if v is None:
            return v
        out = clean_str_list([x.lower() for x in v], max_items=3, max_len=5)
        if any(x not in LANGUAGES for x in out):
            raise ValueError("Languages must be en, hi or mr")
        return out

    @field_validator("portfolio_url", "instagram_url", "avatar_url")
    @classmethod
    def _urls(cls, v):
        return validate_url(v)


class ModerationIn(StrictModel):
    status: Literal["active", "flagged", "suspended"]
    is_verified: Optional[bool] = None


# ---- reports -------------------------------------------------------------------------------
class ReportIn(StrictModel):
    target_type: Literal["editor_profile", "creator_profile", "content"]
    target_id: UUID
    reason: str = Field(min_length=3, max_length=80)
    details: Optional[str] = Field(default=None, max_length=1000)


class ReportUpdateIn(StrictModel):
    status: Literal["open", "reviewing", "resolved", "dismissed"]
    resolution_note: Optional[str] = Field(default=None, max_length=1000)


# ---- admin: users / categories / trends / settings ----------------------------------------
class AdminUserPatch(StrictModel):
    is_active: Optional[bool] = None
    role: Optional[Literal["creator", "editor"]] = None
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=120)


class CategoryIn(StrictModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = True


class CategoryUpdate(StrictModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None


class TrendAdminIn(StrictModel):
    topic: str = Field(min_length=2, max_length=200)
    category: Optional[Union[str, int]] = None
    platform: Optional[Union[str, int]] = None
    language: Literal["en", "hi", "mr"] = "en"
    recency_days: float = Field(default=1, ge=0, le=3650)
    growth_pct: float = Field(default=0, ge=-100, le=100000)
    engagement_rate: float = Field(default=0, ge=0, le=100)
    topic_frequency: int = Field(default=0, ge=0, le=10_000_000)
    content_count: int = Field(default=0, ge=0, le=10_000_000)
    related_topics: list[str] = Field(default_factory=list)
    trend_score: Optional[float] = Field(default=None, ge=0, le=100)  # used only if scoring engine unavailable
    source: Optional[str] = Field(default=None, max_length=60)
    is_active: bool = True

    @field_validator("related_topics")
    @classmethod
    def _rel(cls, v):
        return clean_str_list(v, max_items=12, max_len=80)


class TrendAdminUpdate(StrictModel):
    topic: Optional[str] = Field(default=None, min_length=2, max_length=200)
    category: Optional[Union[str, int]] = None
    platform: Optional[Union[str, int]] = None
    language: Optional[Literal["en", "hi", "mr"]] = None
    recency_days: Optional[float] = Field(default=None, ge=0, le=3650)
    growth_pct: Optional[float] = Field(default=None, ge=-100, le=100000)
    engagement_rate: Optional[float] = Field(default=None, ge=0, le=100)
    topic_frequency: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    content_count: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    related_topics: Optional[list[str]] = None
    trend_score: Optional[float] = Field(default=None, ge=0, le=100)
    source: Optional[str] = Field(default=None, max_length=60)
    is_active: Optional[bool] = None

    @field_validator("related_topics")
    @classmethod
    def _rel(cls, v):
        return None if v is None else clean_str_list(v, max_items=12, max_len=80)


class SettingsIn(StrictModel):
    open_registration: Optional[bool] = None
    ai_daily_limit_per_user: Optional[int] = Field(default=None, ge=1, le=100000)
    announcement: Optional[str] = Field(default=None, max_length=300)
