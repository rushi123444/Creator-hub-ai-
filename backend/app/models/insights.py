"""Insight data: trends, trend_topics, analytics, competitors, recommendations."""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer,
    String, Text, Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPrimaryKey, utcnow


class Trend(UUIDPrimaryKey, Base):
    """A discoverable topic. trend_score is a PROJECT-DEFINED analytical score (0-100),
    not an official platform metric."""

    __tablename__ = "trends"
    __table_args__ = (
        CheckConstraint("trend_score >= 0 AND trend_score <= 100", name="score_range"),
        Index("ix_trends_category_platform", "category_id", "platform_id"),
    )

    topic: Mapped[str] = mapped_column(String(200), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    trend_score: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    score_breakdown: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)  # recency/growth/engagement/frequency
    growth_pct: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    content_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    topic_frequency: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    related_topics: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    history: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # [{"date": "2026-09-01", "score": 41.2}, ...]
    source: Mapped[str] = mapped_column(String(60), default="CreatorHub sample data", nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    topics: Mapped[list["TrendTopic"]] = relationship(back_populates="trend", cascade="all, delete-orphan")


class TrendTopic(Base):
    __tablename__ = "trend_topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trend_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("trends.id", ondelete="CASCADE"), nullable=False, index=True)
    keyword: Mapped[str] = mapped_column(String(120), nullable=False)
    frequency: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    trend: Mapped[Trend] = relationship(back_populates="topics")


class AnalyticsEntry(UUIDPrimaryKey, Base):
    """One content performance record (manually entered, imported, or seeded)."""

    __tablename__ = "analytics"
    __table_args__ = (Index("ix_analytics_user_date", "user_id", "recorded_on"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("content.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    language_code: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    recorded_on: Mapped[date] = mapped_column(Date, nullable=False)
    publication_date: Mapped[Optional[date]] = mapped_column(Date)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    saves: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reach: Mapped[Optional[int]] = mapped_column(Integer)  # nullable: views-based engagement used when absent
    watch_time_minutes: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    followers_gained: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Competitor(UUIDPrimaryKey, Base):
    """Result of analysing PUBLIC data about a channel/creator. Never private analytics."""

    __tablename__ = "competitors"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    handle_or_url: Mapped[str] = mapped_column(String(500), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(200))
    analysis: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Recommendation(UUIDPrimaryKey, Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        CheckConstraint("kind IN ('topic','format','timing','language','platform','engagement')", name="kind_valid"),
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)  # NULL = global
    kind: Mapped[str] = mapped_column(String(20), default="topic", nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[Optional[str]] = mapped_column(Text)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    language_code: Mapped[Optional[str]] = mapped_column(String(5), ForeignKey("languages.code"))
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
