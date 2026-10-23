"""Creator workspace: content, content_ideas, scripts, hooks, captions, hashtags, content_calendar."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String,
    Text, Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, Timestamps, UUIDPrimaryKey, utcnow

CONTENT_STATUSES = ("idea", "draft", "script", "recording", "editing", "scheduled", "published")
STATUS_SQL = "('idea','draft','script','recording','editing','scheduled','published')"


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)


def _content_fk() -> Mapped[Optional[uuid.UUID]]:
    return mapped_column(Uuid, ForeignKey("content.id", ondelete="SET NULL"), index=True)


class Content(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "content"
    __table_args__ = (
        CheckConstraint(f"status IN {STATUS_SQL}", name="status_valid"),
        Index("ix_content_user_status", "user_id", "status"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(30), default="reel", nullable=False)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)  # script / main text
    caption: Mapped[Optional[str]] = mapped_column(Text)
    hashtags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class ContentIdea(UUIDPrimaryKey, Base):
    __tablename__ = "content_ideas"

    user_id: Mapped[uuid.UUID] = _user_fk()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    format: Mapped[Optional[str]] = mapped_column(String(60))
    reason: Mapped[Optional[str]] = mapped_column(Text)
    suggested_hook: Mapped[Optional[str]] = mapped_column(Text)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Script(UUIDPrimaryKey, Base):
    __tablename__ = "scripts"

    user_id: Mapped[uuid.UUID] = _user_fk()
    content_id: Mapped[Optional[uuid.UUID]] = _content_fk()
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    hook: Mapped[Optional[str]] = mapped_column(Text)
    introduction: Mapped[Optional[str]] = mapped_column(Text)
    main_points: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    examples: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    cta: Mapped[Optional[str]] = mapped_column(Text)
    ending: Mapped[Optional[str]] = mapped_column(Text)
    full_script: Mapped[Optional[str]] = mapped_column(Text)
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    tone: Mapped[Optional[str]] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Hook(UUIDPrimaryKey, Base):
    __tablename__ = "hooks"
    __table_args__ = (CheckConstraint("hook_type IN ('question','curiosity','problem','benefit','story')", name="type_valid"),)

    user_id: Mapped[uuid.UUID] = _user_fk()
    content_id: Mapped[Optional[uuid.UUID]] = _content_fk()
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    hook_type: Mapped[str] = mapped_column(String(20), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    is_saved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Caption(UUIDPrimaryKey, Base):
    __tablename__ = "captions"

    user_id: Mapped[uuid.UUID] = _user_fk()
    content_id: Mapped[Optional[uuid.UUID]] = _content_fk()
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    instagram_caption: Mapped[Optional[str]] = mapped_column(Text)
    youtube_description: Mapped[Optional[str]] = mapped_column(Text)
    short_description: Mapped[Optional[str]] = mapped_column(Text)
    cta: Mapped[Optional[str]] = mapped_column(Text)
    keywords: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    is_saved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Hashtag(UUIDPrimaryKey, Base):
    __tablename__ = "hashtags"

    user_id: Mapped[uuid.UUID] = _user_fk()
    content_id: Mapped[Optional[uuid.UUID]] = _content_fk()
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    broad: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    medium: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    niche: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    is_saved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class ContentCalendar(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "content_calendar"
    __table_args__ = (
        CheckConstraint(f"status IN {STATUS_SQL}", name="status_valid"),
        Index("ix_calendar_user_scheduled", "user_id", "scheduled_at"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    content_id: Mapped[Optional[uuid.UUID]] = _content_fk()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), default="idea", nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
