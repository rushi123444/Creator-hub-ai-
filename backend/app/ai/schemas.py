"""Typed AI output shapes (contract section 5) plus helpers for OpenAI structured output.

Every model here describes ONE JSON object the model must return. `strict_json_schema` turns a
model into a JSON Schema acceptable to the Responses API strict structured-output mode
(all properties required, `additionalProperties: false`, no unsupported keywords). Python-side
validation (`parse_output`) is the real gate: provider output is never trusted as-is.
"""
from __future__ import annotations

import re
from typing import Any, Literal, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

HookTypeName = Literal["question", "curiosity", "problem", "benefit", "story"]
HOOK_ORDER = ("question", "curiosity", "problem", "benefit", "story")

_T = TypeVar("_T", bound=BaseModel)


class _Out(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


def _clean_list(values: Any, *, limit: int) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for v in values or []:
        s = str(v).strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out[:limit]


def _tag(value: str) -> str:
    s = re.sub(r"\s+", "", str(value).strip())
    s = s.lstrip("#")
    s = re.sub(r"[^\wऀ-ॿ]", "", s)
    return f"#{s}" if s else ""


def _tags(values: Any, *, limit: int = 15) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for v in values or []:
        t = _tag(v)
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    return out[:limit]


class HookOut(_Out):
    type: HookTypeName
    text: str = Field(min_length=1, max_length=600)


class ScriptOut(_Out):
    hook: str = Field(min_length=1)
    introduction: str = Field(min_length=1)
    main_points: list[str] = Field(min_length=1)
    examples: list[str] = Field(default_factory=list)
    cta: str = Field(min_length=1)
    ending: str = Field(min_length=1)
    full_script: str = Field(min_length=1)

    @field_validator("main_points")
    @classmethod
    def _points(cls, v: list[str]) -> list[str]:
        cleaned = _clean_list(v, limit=10)
        if not cleaned:
            raise ValueError("main_points empty")
        return cleaned

    @field_validator("examples")
    @classmethod
    def _examples(cls, v: list[str]) -> list[str]:
        return _clean_list(v, limit=6)


class CaptionOut(_Out):
    instagram_caption: str = Field(min_length=1)
    youtube_description: str = Field(min_length=1)
    short_description: str = Field(min_length=1)
    cta: str = Field(min_length=1)
    keywords: list[str] = Field(default_factory=list)

    @field_validator("keywords")
    @classmethod
    def _keywords(cls, v: list[str]) -> list[str]:
        return _clean_list(v, limit=15)


class HashtagsOut(_Out):
    broad: list[str] = Field(default_factory=list)
    medium: list[str] = Field(default_factory=list)
    niche: list[str] = Field(default_factory=list)

    @field_validator("broad", "medium", "niche")
    @classmethod
    def _norm(cls, v: list[str]) -> list[str]:
        return _tags(v)

    @field_validator("niche")
    @classmethod
    def _need_some(cls, v: list[str]) -> list[str]:
        return v


class IdeaOut(_Out):
    title: str = Field(min_length=1, max_length=200)
    topic: str = Field(min_length=1, max_length=200)
    format: str = Field(min_length=1, max_length=60)
    reason: str = Field(min_length=1)
    suggested_hook: str = Field(min_length=1)


class ShortOut(_Out):
    short_idea: str = Field(min_length=1)
    hook: str = Field(min_length=1)
    suggested_duration_seconds: int = Field(ge=1)
    key_section: str = Field(min_length=1)
    short_script: str = Field(min_length=1)
    cta: str = Field(min_length=1)

    @field_validator("suggested_duration_seconds")
    @classmethod
    def _dur(cls, v: int) -> int:
        return max(10, min(int(v), 180))


# ---- root payloads (one JSON object per model call) ---------------------------------------------
class HooksPayload(_Out):
    hooks: list[HookOut] = Field(min_length=1)

    @field_validator("hooks")
    @classmethod
    def _one_each(cls, v: list[HookOut]) -> list[HookOut]:
        by_type: dict[str, HookOut] = {}
        for hook in v:
            by_type.setdefault(hook.type, hook)
        missing = [t for t in HOOK_ORDER if t not in by_type]
        if missing:
            raise ValueError("missing hook types")
        return [by_type[t] for t in HOOK_ORDER]


class IdeasPayload(_Out):
    ideas: list[IdeaOut] = Field(min_length=1)

    @field_validator("ideas")
    @classmethod
    def _cap(cls, v: list[IdeaOut]) -> list[IdeaOut]:
        return v[:8]


class ShortsPayload(_Out):
    shorts: list[ShortOut] = Field(min_length=3)

    @field_validator("shorts")
    @classmethod
    def _three(cls, v: list[ShortOut]) -> list[ShortOut]:
        return v[:3]


class BundleOut(_Out):
    title: str = Field(min_length=1, max_length=200)
    hooks: list[HookOut] = Field(min_length=1)
    script: ScriptOut
    caption: CaptionOut
    hashtags: HashtagsOut
    cta: str = Field(min_length=1)
    ideas: list[IdeaOut] = Field(min_length=1)

    @field_validator("hooks")
    @classmethod
    def _one_each(cls, v: list[HookOut]) -> list[HookOut]:
        return HooksPayload(hooks=v).hooks

    @field_validator("ideas")
    @classmethod
    def _cap(cls, v: list[IdeaOut]) -> list[IdeaOut]:
        return v[:8]


class TitlePayload(_Out):
    title: str = Field(min_length=1, max_length=200)


class CtaPayload(_Out):
    cta: str = Field(min_length=1, max_length=600)


class SingleHookPayload(_Out):
    hook: HookOut


class ChatReply(_Out):
    reply: str = Field(min_length=1, max_length=6000)


class SummaryOut(_Out):
    summary: str = Field(min_length=1, max_length=4000)


class ClassifyOut(_Out):
    category: str = Field(min_length=1, max_length=80)
    confidence_label: Literal["low", "medium", "high"]


class PatternSummary(_Out):
    summary: str = Field(min_length=1, max_length=3000)
    takeaways: list[str] = Field(default_factory=list)

    @field_validator("takeaways")
    @classmethod
    def _t(cls, v: list[str]) -> list[str]:
        return _clean_list(v, limit=6)


class PolishedItem(_Out):
    id: str
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=600)


class PolishedRecommendations(_Out):
    items: list[PolishedItem] = Field(min_length=1)


_DROP_KEYS = {
    "title", "default", "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum",
    "exclusiveMinimum", "exclusiveMaximum", "format", "pattern", "examples",
}


def strict_json_schema(model: type[BaseModel]) -> dict:
    """JSON Schema for `text.format` with `strict: true` (inlined refs, all fields required)."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def walk(node: Any) -> Any:
        if isinstance(node, list):
            return [walk(n) for n in node]
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            return walk(defs[node["$ref"].split("/")[-1]])
        out: dict[str, Any] = {}
        for key, value in node.items():
            if key == "properties":
                out[key] = {name: walk(prop) for name, prop in value.items()}
            elif key in _DROP_KEYS:
                continue
            else:
                out[key] = walk(value)
        if out.get("type") == "object" and "properties" in out:
            out["required"] = list(out["properties"].keys())
            out["additionalProperties"] = False
        return out

    return walk(schema)


class InvalidModelOutput(ValueError):
    """Raised when provider output is empty, not JSON, or does not match the expected shape."""


def parse_output(model: type[_T], data: Any) -> _T:
    """Validate a decoded JSON object against `model`; any mismatch is an InvalidModelOutput."""
    if not isinstance(data, dict) or not data:
        raise InvalidModelOutput("empty or non-object output")
    try:
        return model.model_validate(data)
    except ValidationError as exc:  # never leak the provider text; the caller only logs the shape
        raise InvalidModelOutput(f"{len(exc.errors())} validation problems") from exc


def optional_str(value: Optional[str]) -> str:
    return (value or "").strip()
