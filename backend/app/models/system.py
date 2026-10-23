"""System tables: ai_requests, reports, notifications, platform_settings."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, Timestamps, UUIDPrimaryKey, utcnow


class AIRequest(UUIDPrimaryKey, Base):
    """Audit/usage log. Stores sizes and metadata only, never prompts or API keys."""

    __tablename__ = "ai_requests"
    __table_args__ = (
        CheckConstraint("status IN ('success','sample','error')", name="status_valid"),
        Index("ix_ai_requests_user_created", "user_id", "created_at"),
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    feature: Mapped[str] = mapped_column(String(40), nullable=False)  # hooks | script | caption | hashtags | ideas | assistant | long_to_short | ...
    language_code: Mapped[Optional[str]] = mapped_column(String(5))
    status: Mapped[str] = mapped_column(String(10), default="success", nullable=False)  # success | sample | error
    model: Mapped[Optional[str]] = mapped_column(String(60))
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    input_chars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    output_chars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Report(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("status IN ('open','reviewing','resolved','dismissed')", name="status_valid"),
        CheckConstraint("target_type IN ('editor_profile','creator_profile','content')", name="target_valid"),
    )

    reporter_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    reason: Mapped[str] = mapped_column(String(80), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="open", nullable=False)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))


class Notification(UUIDPrimaryKey, Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(30), default="info", nullable=False)
    link: Mapped[Optional[str]] = mapped_column(String(300))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class PlatformSetting(Base):
    """Non-secret, admin-editable platform settings (e.g. open_registration, ai_daily_limit)."""

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
