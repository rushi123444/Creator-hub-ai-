"""Accounts and profiles: users, profiles, creator_profiles, editor_profiles, editor_skills."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String,
    Text, UniqueConstraint, Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, Timestamps, UUIDPrimaryKey

ROLES = ("creator", "editor", "admin")


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('creator','editor','admin')", name="role_valid"),)

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="creator", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    profile: Mapped[Optional["Profile"]] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    creator_profile: Mapped[Optional["CreatorProfile"]] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class Profile(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(40), unique=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    preferred_language: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    ui_language: Mapped[str] = mapped_column(String(5), ForeignKey("languages.code"), default="en", nullable=False)
    profile_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[User] = relationship(back_populates="profile")


class CreatorProfile(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "creator_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    platform_id: Mapped[Optional[int]] = mapped_column(ForeignKey("platforms.id", ondelete="SET NULL"))
    creator_type: Mapped[Optional[str]] = mapped_column(String(40))  # solo | educator | student | brand | agency
    experience_level: Mapped[Optional[str]] = mapped_column(String(20))  # beginner | intermediate | advanced
    interests: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    default_tone: Mapped[Optional[str]] = mapped_column(String(30))

    user: Mapped[User] = relationship(back_populates="creator_profile")


class EditorProfile(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "editor_profiles"
    __table_args__ = (
        CheckConstraint("status IN ('active','flagged','suspended')", name="status_valid"),
        CheckConstraint("specialization IN ('reels','youtube','motion_graphics','thumbnail','gaming')", name="specialization_valid"),
        Index("ix_editor_profiles_specialization", "specialization"),
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    headline: Mapped[Optional[str]] = mapped_column(String(160))
    specialization: Mapped[str] = mapped_column(String(30), nullable=False)
    languages: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # ["en","hi","mr"]
    experience_years: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500))
    instagram_url: Mapped[Optional[str]] = mapped_column(String(500))
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    skills: Mapped[list["EditorSkill"]] = relationship(back_populates="editor", cascade="all, delete-orphan")


class EditorSkill(Base):
    __tablename__ = "editor_skills"
    __table_args__ = (UniqueConstraint("editor_id", "skill", name="editor_skill_unique"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    editor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("editor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    skill: Mapped[str] = mapped_column(String(60), nullable=False)

    editor: Mapped[EditorProfile] = relationship(back_populates="skills")
