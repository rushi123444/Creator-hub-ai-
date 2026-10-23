"""Request/response schemas for /ai/* routes (contract section 5)."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class _In(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


Lang = Literal["en", "hi", "mr"]


class GenerateRequest(_In):
    """Common request fields. Omitted profile fields are filled from the creator's profile."""

    topic: Optional[str] = Field(default=None, max_length=200)
    language: Optional[Lang] = None
    platform: Optional[str] = Field(default=None, max_length=40)
    category: Optional[str] = Field(default=None, max_length=80)
    audience: Optional[str] = Field(default=None, max_length=200)
    tone: Optional[str] = Field(default=None, max_length=30)
    duration_seconds: Optional[int] = Field(default=None, ge=5, le=1800)
    content_type: Optional[str] = Field(default=None, max_length=30)
    instructions: Optional[str] = Field(default=None, max_length=1000)


class RegenerateRequest(_In):
    section: Literal["hooks", "hook", "script", "caption", "hashtags", "title", "cta", "ideas"]
    hook_type: Optional[Literal["question", "curiosity", "problem", "benefit", "story"]] = None
    params: GenerateRequest = Field(default_factory=GenerateRequest)
    current: Optional[Any] = None


class ChatMessage(_In):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantRequest(_In):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    language: Optional[Lang] = None


class LongToShortRequest(_In):
    source_text: str = Field(min_length=80, max_length=30000)
    target_platform: Optional[str] = Field(default=None, max_length=40)
    language: Optional[Lang] = None
    target_duration_seconds: Optional[int] = Field(default=None, ge=10, le=180)


class SummarizeRequest(_In):
    text: str = Field(min_length=1, max_length=30000)
    language: Optional[Lang] = None


class ClassifyRequest(_In):
    text: str = Field(min_length=1, max_length=5000)


class HookItem(BaseModel):
    type: str
    text: str


class HooksResponse(BaseModel):
    hooks: list[HookItem]
    is_sample: bool
    model: str


class ScriptResponse(BaseModel):
    script: dict
    is_sample: bool
    model: str


class CaptionResponse(BaseModel):
    caption: dict
    is_sample: bool
    model: str


class HashtagsResponse(BaseModel):
    hashtags: dict
    is_sample: bool
    model: str


class IdeasResponse(BaseModel):
    ideas: list[dict]
    is_sample: bool
    model: str


class GenerateResponse(BaseModel):
    title: str
    hooks: list[HookItem]
    script: dict
    caption: dict
    hashtags: dict
    cta: str
    ideas: list[dict]
    is_sample: bool
    model: str


class RegenerateResponse(BaseModel):
    section: str
    value: Any
    is_sample: bool
    model: str


class AssistantMessage(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str


class AssistantResponse(BaseModel):
    message: AssistantMessage
    is_sample: bool
    model: str


class LongToShortResponse(BaseModel):
    shorts: list[dict]
    is_sample: bool
    model: str


class SummarizeResponse(BaseModel):
    summary: str
    is_sample: bool
    model: str


class ClassifyResponse(BaseModel):
    category: str
    confidence_label: str
    is_sample: bool
    model: str
