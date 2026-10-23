"""Auth and profile schemas."""
from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import (
    CREATOR_TYPES, EXPERIENCE_LEVELS, LANGUAGES, StrictModel, TONES, clean_str_list, validate_url,
)


def _norm_email(v: str) -> str:
    return v.strip().lower()


class RegisterIn(StrictModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["creator", "editor"] = "creator"

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _norm_email(v)

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Please enter your name")
        return v


class LoginIn(StrictModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = False

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _norm_email(v)


class ForgotPasswordIn(StrictModel):
    email: str = Field(min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _norm_email(v)


class ResetPasswordIn(StrictModel):
    token: str = Field(min_length=10, max_length=2000)
    new_password: str = Field(min_length=8, max_length=128)


class ProfileOut(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    preferred_language: str = "en"
    ui_language: str = "en"
    profile_completed: bool = False


class CreatorProfileOut(BaseModel):
    category_id: Optional[int] = None
    platform_id: Optional[int] = None
    creator_type: Optional[str] = None
    experience_level: Optional[str] = None
    interests: list[str] = []
    default_tone: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    profile: ProfileOut
    creator_profile: Optional[CreatorProfileOut] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdateIn(StrictModel):
    """Union of profile + creator_profile fields + full_name. Only supplied fields change."""

    full_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    username: Optional[str] = Field(default=None, max_length=40)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    bio: Optional[str] = Field(default=None, max_length=1000)
    preferred_language: Optional[Literal["en", "hi", "mr"]] = None
    ui_language: Optional[Literal["en", "hi", "mr"]] = None
    category_id: Optional[int] = None
    platform_id: Optional[int] = None
    category: Optional[Union[str, int]] = None  # slug / name accepted as an alternative to ids
    platform: Optional[Union[str, int]] = None
    creator_type: Optional[Literal["solo", "educator", "student", "brand", "agency"]] = None
    experience_level: Optional[Literal["beginner", "intermediate", "advanced"]] = None
    interests: Optional[list[str]] = None
    default_tone: Optional[Literal["educational", "professional", "funny", "storytelling", "motivational", "casual", "curious"]] = None

    @field_validator("username")
    @classmethod
    def _username(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        import re
        if not re.fullmatch(r"[A-Za-z0-9_.]{3,40}", v):
            raise ValueError("Username must be 3-40 characters: letters, numbers, dot or underscore")
        return v

    @field_validator("avatar_url")
    @classmethod
    def _avatar(cls, v: Optional[str]) -> Optional[str]:
        return validate_url(v)

    @field_validator("interests")
    @classmethod
    def _interests(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        return None if v is None else clean_str_list(v, max_items=20, max_len=40)
