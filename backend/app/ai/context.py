"""Shared generation context and reference constants for the AI package."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

LANGUAGES = ("en", "hi", "mr")
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "mr": "Marathi"}

CATEGORIES = ("Technology", "Education", "Gaming", "Business", "Entertainment", "Fitness")
PLATFORMS = ("instagram", "youtube", "youtube_shorts", "facebook", "x", "linkedin", "other")
PLATFORM_LABELS = {
    "instagram": "Instagram",
    "youtube": "YouTube",
    "youtube_shorts": "YouTube Shorts",
    "facebook": "Facebook",
    "x": "X",
    "linkedin": "LinkedIn",
    "other": "Other",
}
TONES = ("educational", "professional", "funny", "storytelling", "motivational", "casual", "curious")
HOOK_TYPES = ("question", "curiosity", "problem", "benefit", "story")


def normalise_language(value: Optional[str], default: str = "en") -> str:
    code = (value or "").strip().lower()[:2]
    return code if code in LANGUAGES else default


def normalise_platform(value: Optional[str], default: str = "instagram") -> str:
    slug = (value or "").strip().lower().replace(" ", "_").replace("-", "_")
    if slug in PLATFORMS:
        return slug
    if slug in ("shorts", "yt_shorts"):
        return "youtube_shorts"
    if slug in ("yt", "you_tube"):
        return "youtube"
    if slug in ("twitter",):
        return "x"
    return default if not slug else "other"


def normalise_category(value: Optional[str]) -> Optional[str]:
    """Return the canonical category name for a slug/name, or the cleaned free text, or None."""
    text = (value or "").strip()
    if not text:
        return None
    for name in CATEGORIES:
        if text.lower() == name.lower():
            return name
    return text


def normalise_tone(value: Optional[str], default: str = "educational") -> str:
    tone = (value or "").strip().lower()
    return tone if tone in TONES else default


@dataclass
class GenContext:
    """Everything a generator or prompt needs. Request fields override profile fields."""

    topic: str = ""
    language: str = "en"
    platform: str = "instagram"
    category: Optional[str] = None
    audience: Optional[str] = None
    tone: str = "educational"
    duration_seconds: int = 60
    content_type: str = "reel"
    instructions: Optional[str] = None
    creator_type: Optional[str] = None
    experience_level: Optional[str] = None
    interests: list[str] = field(default_factory=list)
    variation: int = 0  # bumped by /ai/regenerate so sample output differs between calls

    @property
    def platform_label(self) -> str:
        return PLATFORM_LABELS.get(self.platform, self.platform.title())
