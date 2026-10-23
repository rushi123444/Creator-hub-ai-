"""Reference-data lookups (platform / category / language) by slug, name or id."""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.reference import Category, Language, Platform

LANGUAGE_CODES = ("en", "hi", "mr")
_LANG_ALIASES = {
    "english": "en", "en": "en", "en-us": "en", "en-in": "en",
    "hindi": "hi", "hi": "hi", "hi-in": "hi",
    "marathi": "mr", "mr": "mr", "mr-in": "mr",
}
_PLATFORM_ALIASES = {
    "ig": "instagram", "insta": "instagram", "reels": "instagram",
    "yt": "youtube", "youtube video": "youtube",
    "shorts": "youtube_shorts", "youtube shorts": "youtube_shorts", "youtube-shorts": "youtube_shorts",
    "fb": "facebook", "twitter": "x", "x (twitter)": "x",
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def language_code(value: Optional[str], default: Optional[str] = None) -> Optional[str]:
    """Normalise a language value (code or English name) to en|hi|mr. Unknown => default."""
    if not value:
        return default
    return _LANG_ALIASES.get(str(value).strip().lower(), default)


def platform_id(db: Session, slug_or_name: Optional[str | int]) -> Optional[int]:
    if slug_or_name is None or slug_or_name == "":
        return None
    if isinstance(slug_or_name, int):
        return db.scalar(select(Platform.id).where(Platform.id == slug_or_name))
    raw = str(slug_or_name).strip()
    s = slugify(raw)
    s = _PLATFORM_ALIASES.get(raw.lower(), _PLATFORM_ALIASES.get(s, s))
    pid = db.scalar(select(Platform.id).where(Platform.slug == s))
    if pid is None:
        pid = db.scalar(select(Platform.id).where(func.lower(Platform.name) == raw.lower()))
    return pid


def category_id(db: Session, slug_or_name: Optional[str | int]) -> Optional[int]:
    if slug_or_name is None or slug_or_name == "":
        return None
    if isinstance(slug_or_name, int):
        return db.scalar(select(Category.id).where(Category.id == slug_or_name))
    raw = str(slug_or_name).strip()
    cid = db.scalar(select(Category.id).where(Category.slug == raw.lower()))
    if cid is None:
        cid = db.scalar(select(Category.id).where(func.lower(Category.name) == raw.lower()))
    if cid is None:
        cid = db.scalar(select(Category.id).where(Category.slug == slugify(raw).replace("_", "-")))
    return cid


def platform_slug(db: Session, id_: Optional[int]) -> Optional[str]:
    if id_ is None:
        return None
    return db.scalar(select(Platform.slug).where(Platform.id == id_))


def platform_name(db: Session, id_: Optional[int]) -> Optional[str]:
    if id_ is None:
        return None
    return db.scalar(select(Platform.name).where(Platform.id == id_))


def category_name(db: Session, id_: Optional[int]) -> Optional[str]:
    if id_ is None:
        return None
    return db.scalar(select(Category.name).where(Category.id == id_))


def category_slug(db: Session, id_: Optional[int]) -> Optional[str]:
    if id_ is None:
        return None
    return db.scalar(select(Category.slug).where(Category.id == id_))


def language_exists(db: Session, code: str) -> bool:
    return db.scalar(select(Language.code).where(Language.code == code)) is not None
