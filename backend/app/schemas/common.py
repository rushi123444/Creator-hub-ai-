"""Shared constants and reusable field types for the core schemas."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

CONTENT_STATUSES = ("idea", "draft", "script", "recording", "editing", "scheduled", "published")
CONTENT_TYPES = ("reel", "youtube_short", "youtube_video", "educational", "tutorial", "post", "caption", "other")
TONES = ("educational", "professional", "funny", "storytelling", "motivational", "casual", "curious")
SPECIALIZATIONS = ("reels", "youtube", "motion_graphics", "thumbnail", "gaming")
LANGUAGES = ("en", "hi", "mr")
HOOK_TYPES = ("question", "curiosity", "problem", "benefit", "story")
PLATFORM_SLUGS = ("instagram", "youtube", "youtube_shorts", "facebook", "x", "linkedin", "other")
CREATOR_TYPES = ("solo", "educator", "student", "brand", "agency")
EXPERIENCE_LEVELS = ("beginner", "intermediate", "advanced")
REPORT_TARGETS = ("editor_profile", "creator_profile", "content")
REPORT_STATUSES = ("open", "reviewing", "resolved", "dismissed")

ContentStatus = Literal["idea", "draft", "script", "recording", "editing", "scheduled", "published"]
ContentType = Literal["reel", "youtube_short", "youtube_video", "educational", "tutorial", "post", "caption", "other"]
Tone = Literal["educational", "professional", "funny", "storytelling", "motivational", "casual", "curious"]
Specialization = Literal["reels", "youtube", "motion_graphics", "thumbnail", "gaming"]
HookType = Literal["question", "curiosity", "problem", "benefit", "story"]

Text20 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20)]
Text40 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]
Text60 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]
Text80 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)]
Text120 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
Text160 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
Text200 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Text500 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Text2000 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Text5000 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
Text20000 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20000)]

_URL_RE = re.compile(r"^https?://[^\s<>\"']+$", re.IGNORECASE)


class StrictModel(BaseModel):
    """Base for request bodies: unknown keys are ignored, strings are stripped."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


def validate_url(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return None
    if len(value) > 500 or not _URL_RE.match(value):
        raise ValueError("Enter a valid link starting with http:// or https://")
    return value


def clean_str_list(values: Optional[list], *, max_items: int, max_len: int) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for v in values or []:
        s = str(v).strip()
        if not s:
            continue
        if len(s) > max_len:
            raise ValueError(f"Each item must be {max_len} characters or fewer")
        if s.lower() in seen:
            continue
        seen.add(s.lower())
        out.append(s)
    if len(out) > max_items:
        raise ValueError(f"No more than {max_items} items are allowed")
    return out


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Treat naive datetimes as UTC (SQLite returns naive values)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    """ISO-8601 UTC with a trailing Z, as in the API contract."""
    dt = ensure_utc(dt)
    if dt is None:
        return None
    return dt.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


class ListQuery(BaseModel):
    limit: int = 50
    offset: int = 0

    @field_validator("limit")
    @classmethod
    def _limit(cls, v: int) -> int:
        return max(1, min(v, 200))
