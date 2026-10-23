"""AIService: the ONE service every AI route (and the recommendation/competitor polish steps) goes through.

Modes
- No OPENAI_API_KEY: deterministic sample generator (`is_sample=True`, model "sample").
- Key present: OpenAI Responses API via `app.ai.client` with strict JSON-schema output, validated by
  `app.ai.schemas`. Any failure => AIUnavailableError (503, friendly message, no provider text).

Every call writes one `ai_requests` row (metadata only: feature, language, status, model, latency, sizes).
Prompts, outputs and keys are never stored or logged.
"""
from __future__ import annotations

import json
import logging
import time
import zlib
from dataclasses import dataclass, replace
from typing import Any, Callable, Optional, TypeVar

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import client as ai_client
from app.ai import prompts, sample_generator as sample
from app.ai.context import (
    CATEGORIES, GenContext, normalise_category, normalise_language, normalise_platform, normalise_tone,
)
from app.ai.schemas import (
    BundleOut, CaptionOut, ChatReply, ClassifyOut, CtaPayload, HashtagsOut, HooksPayload, IdeasPayload,
    InvalidModelOutput, PatternSummary, PolishedRecommendations, ScriptOut, ShortsPayload, SingleHookPayload,
    SummaryOut, TitlePayload, parse_output, strict_json_schema,
)
from app.config.settings import get_settings
from app.errors import AIUnavailableError
from app.models.insights import Trend
from app.models.reference import Category, Platform
from app.models.system import AIRequest
from app.models.user import User

logger = logging.getLogger("creatorhub.ai")
M = TypeVar("M", bound=BaseModel)
SAMPLE_MODEL = "sample"


@dataclass
class AIResult:
    value: Any
    is_sample: bool
    model: str


class AIService:
    def __init__(self, db: Session, user: Optional[User] = None):
        self.db = db
        self.user = user
        self.settings = get_settings()

    # ---- context ----------------------------------------------------------------------------------
    @property
    def live(self) -> bool:
        return bool(self.settings.openai_enabled)

    def context(self, params: Any = None, *, language: Optional[str] = None, variation: int = 0) -> GenContext:
        """Merge request fields over the creator profile. `params` is a pydantic model or dict."""
        data = params.model_dump(exclude_none=True) if isinstance(params, BaseModel) else dict(params or {})
        profile = getattr(self.user, "profile", None) if self.user else None
        cprofile = getattr(self.user, "creator_profile", None) if self.user else None

        prof_category = prof_platform = None
        if cprofile is not None:
            if cprofile.category_id:
                prof_category = self.db.scalar(select(Category.name).where(Category.id == cprofile.category_id))
            if cprofile.platform_id:
                prof_platform = self.db.scalar(select(Platform.slug).where(Platform.id == cprofile.platform_id))
        lang = language or data.get("language") or (profile.preferred_language if profile else None)
        platform = normalise_platform(data.get("platform") or prof_platform)
        content_type = data.get("content_type") or ("youtube_video" if platform == "youtube" else "reel")
        return GenContext(
            topic=(data.get("topic") or "").strip(),
            language=normalise_language(lang),
            platform=platform,
            category=normalise_category(data.get("category") or prof_category),
            audience=data.get("audience"),
            tone=normalise_tone(data.get("tone") or (cprofile.default_tone if cprofile else None)),
            duration_seconds=int(data.get("duration_seconds") or (45 if platform in ("instagram", "youtube_shorts") else 60)),
            content_type=content_type,
            instructions=data.get("instructions"),
            creator_type=cprofile.creator_type if cprofile else None,
            experience_level=cprofile.experience_level if cprofile else None,
            interests=list(cprofile.interests or []) if cprofile else [],
            variation=variation,
        )

    def trend_topics(self, ctx: GenContext, limit: int = 6) -> list[str]:
        """Top current trends relevant to the creator (same language first, then category)."""
        stmt = select(Trend.topic, Trend.language_code, Trend.category_id).where(Trend.is_active.is_(True))
        rows = self.db.execute(stmt.order_by(Trend.trend_score.desc()).limit(80)).all()
        cat_id = None
        if ctx.category:
            cat_id = self.db.scalar(select(Category.id).where(Category.name == ctx.category))

        def rank(row) -> tuple[int, int]:
            return (0 if row.language_code == ctx.language else 1, 0 if cat_id and row.category_id == cat_id else 1)

        ordered = sorted(rows, key=rank)  # stable: keeps score order inside each group
        return [r.topic for r in ordered[:limit]]

    # ---- core runner ------------------------------------------------------------------------------
    def _log(self, feature: str, language: Optional[str], status: str, model: Optional[str],
             started: float, in_chars: int, out_chars: int) -> None:
        try:
            self.db.add(AIRequest(
                user_id=self.user.id if self.user else None, feature=feature, language_code=language,
                status=status, model=model, latency_ms=int((time.perf_counter() - started) * 1000),
                input_chars=in_chars, output_chars=out_chars,
            ))
            self.db.commit()
        except Exception:  # noqa: BLE001 - usage logging must never break a request
            logger.exception("Could not write ai_requests row")
            self.db.rollback()

    def _run(
        self,
        feature: str,
        ctx: GenContext,
        *,
        model_cls: type[M],
        prompt: Callable[[], tuple[str, str]],
        sample_fn: Callable[[], dict],
        in_chars: int = 0,
    ) -> tuple[M, bool, str]:
        started = time.perf_counter()
        language = ctx.language
        if not self.live:
            try:
                parsed = parse_output(model_cls, sample_fn())
            except InvalidModelOutput:  # a template bug must not become a 500
                logger.exception("Sample generator produced invalid %s output", feature)
                self._log(feature, language, "error", SAMPLE_MODEL, started, in_chars, 0)
                raise AIUnavailableError()
            out = len(json.dumps(parsed.model_dump(), ensure_ascii=False))
            self._log(feature, language, "sample", SAMPLE_MODEL, started, in_chars, out)
            return parsed, True, SAMPLE_MODEL
        system, user = prompt()
        model_name = self.settings.openai_model
        try:
            result = ai_client.generate_json(
                system=system, user=user, schema=strict_json_schema(model_cls), schema_name=model_cls.__name__,
            )
            parsed = parse_output(model_cls, result.data)
        except InvalidModelOutput as exc:
            logger.error("AI output failed validation for %s: %s", feature, exc)
            self._log(feature, language, "error", model_name, started, in_chars or len(system) + len(user), 0)
            raise AIUnavailableError()
        except AIUnavailableError:
            self._log(feature, language, "error", model_name, started, in_chars or len(system) + len(user), 0)
            raise
        self._log(feature, language, "success", result.model, started, in_chars or len(system) + len(user), result.output_chars)
        return parsed, False, result.model

    # ---- features ---------------------------------------------------------------------------------
    def hooks(self, ctx: GenContext) -> AIResult:
        out, is_sample, model = self._run(
            "hooks", ctx, model_cls=HooksPayload, prompt=lambda: prompts.hooks_prompts(ctx),
            sample_fn=lambda: {"hooks": sample.hooks(ctx)}, in_chars=len(ctx.topic),
        )
        return AIResult([h.model_dump() for h in out.hooks], is_sample, model)

    def script(self, ctx: GenContext) -> AIResult:
        out, is_sample, model = self._run(
            "script", ctx, model_cls=ScriptOut, prompt=lambda: prompts.script_prompts(ctx),
            sample_fn=lambda: sample.script(ctx), in_chars=len(ctx.topic),
        )
        return AIResult(out.model_dump(), is_sample, model)

    def caption(self, ctx: GenContext) -> AIResult:
        out, is_sample, model = self._run(
            "caption", ctx, model_cls=CaptionOut, prompt=lambda: prompts.caption_prompts(ctx),
            sample_fn=lambda: sample.caption(ctx), in_chars=len(ctx.topic),
        )
        return AIResult(out.model_dump(), is_sample, model)

    def hashtags(self, ctx: GenContext) -> AIResult:
        out, is_sample, model = self._run(
            "hashtags", ctx, model_cls=HashtagsOut, prompt=lambda: prompts.hashtags_prompts(ctx),
            sample_fn=lambda: sample.hashtags(ctx), in_chars=len(ctx.topic),
        )
        return AIResult(out.model_dump(), is_sample, model)

    def ideas(self, ctx: GenContext) -> AIResult:
        trends = self.trend_topics(ctx)
        out, is_sample, model = self._run(
            "ideas", ctx, model_cls=IdeasPayload, prompt=lambda: prompts.ideas_prompts(ctx, trends),
            sample_fn=lambda: {"ideas": sample.ideas(ctx, trends)}, in_chars=len(ctx.topic),
        )
        return AIResult([i.model_dump() for i in out.ideas], is_sample, model)

    def generate(self, ctx: GenContext) -> AIResult:
        trends = self.trend_topics(ctx)
        out, is_sample, model = self._run(
            "generate", ctx, model_cls=BundleOut, prompt=lambda: prompts.bundle_prompts(ctx, trends),
            sample_fn=lambda: sample.bundle(ctx, trends), in_chars=len(ctx.topic),
        )
        return AIResult(out.model_dump(), is_sample, model)

    def regenerate(self, section: str, ctx: GenContext, *, hook_type: Optional[str] = None,
                   current: Any = None) -> AIResult:
        """Regenerate ONE section. Sample output rotates templates via `ctx.variation`."""
        seed = zlib.crc32(json.dumps(current, ensure_ascii=False, default=str, sort_keys=True).encode()) if current else 0
        ctx = replace(ctx, variation=ctx.variation + 1 + (seed % 5))
        if current:
            note = "Offer a clearly different take from the previous version."
            ctx = replace(ctx, instructions=((ctx.instructions or "") + " " + note).strip()[:1100])
        if section == "hooks":
            return self.hooks(ctx)
        if section == "hook":
            htype = hook_type or "question"
            out, is_sample, model = self._run(
                "hook", ctx, model_cls=SingleHookPayload, prompt=lambda: prompts.single_hook_prompts(ctx, htype),
                sample_fn=lambda: {"hook": sample.hook_for(ctx, htype)}, in_chars=len(ctx.topic),
            )
            hook = out.hook.model_dump()
            hook["type"] = htype
            return AIResult(hook, is_sample, model)
        if section == "script":
            return self.script(ctx)
        if section == "caption":
            return self.caption(ctx)
        if section == "hashtags":
            return self.hashtags(ctx)
        if section == "ideas":
            return self.ideas(ctx)
        if section == "title":
            out, is_sample, model = self._run(
                "title", ctx, model_cls=TitlePayload, prompt=lambda: prompts.title_prompts(ctx),
                sample_fn=lambda: {"title": sample.title(ctx)}, in_chars=len(ctx.topic),
            )
            return AIResult(out.title, is_sample, model)
        if section == "cta":
            out, is_sample, model = self._run(
                "cta", ctx, model_cls=CtaPayload, prompt=lambda: prompts.cta_prompts(ctx),
                sample_fn=lambda: {"cta": sample.cta(ctx)}, in_chars=len(ctx.topic),
            )
            return AIResult(out.cta, is_sample, model)
        raise AIUnavailableError()

    def assistant(self, ctx: GenContext, messages: list[dict[str, str]]) -> AIResult:
        trends = self.trend_topics(ctx, 5)
        chars = sum(len(m["content"]) for m in messages)
        out, is_sample, model = self._run(
            "assistant", ctx, model_cls=ChatReply, prompt=lambda: prompts.assistant_prompts(ctx, messages, trends),
            sample_fn=lambda: {"reply": sample.assistant_reply(ctx, messages, trends)}, in_chars=chars,
        )
        return AIResult({"role": "assistant", "content": out.reply}, is_sample, model)

    def long_to_short(self, ctx: GenContext, source_text: str, target_platform: str, target_seconds: int) -> AIResult:
        out, is_sample, model = self._run(
            "long_to_short", ctx, model_cls=ShortsPayload,
            prompt=lambda: prompts.long_to_short_prompts(ctx, source_text, target_platform, target_seconds),
            sample_fn=lambda: {"shorts": sample.long_to_short(ctx, source_text, target_seconds)},
            in_chars=len(source_text),
        )
        return AIResult([s.model_dump() for s in out.shorts], is_sample, model)

    def summarize(self, ctx: GenContext, text: str) -> AIResult:
        out, is_sample, model = self._run(
            "summarize", ctx, model_cls=SummaryOut, prompt=lambda: prompts.summarize_prompts(ctx, text),
            sample_fn=lambda: {"summary": sample.summarize(ctx, text)}, in_chars=len(text),
        )
        return AIResult(out.summary, is_sample, model)

    def classify_topic(self, ctx: GenContext, text: str) -> AIResult:
        def _sample() -> dict:
            cat, label = sample.classify_category(text, default=ctx.category if ctx.category in CATEGORIES else "Education")
            return {"category": cat or "Education", "confidence_label": label}

        out, is_sample, model = self._run(
            "classify", ctx, model_cls=ClassifyOut, prompt=lambda: prompts.classify_prompts(ctx, text, CATEGORIES),
            sample_fn=_sample, in_chars=len(text),
        )
        category = normalise_category(out.category) or out.category
        if category not in CATEGORIES:  # constrain live answers to the known category set
            guess, _ = sample.classify_category(text, default="Education")
            category = guess or "Education"
        return AIResult({"category": category, "confidence_label": out.confidence_label}, is_sample, model)

    def pattern_summary(self, ctx: GenContext, facts: dict[str, Any]) -> AIResult:
        out, is_sample, model = self._run(
            "pattern_summary", ctx, model_cls=PatternSummary, prompt=lambda: prompts.pattern_prompts(ctx, facts),
            sample_fn=lambda: sample.pattern_summary(ctx, facts), in_chars=len(json.dumps(facts, default=str)),
        )
        return AIResult(out.model_dump(), is_sample, model)

    def polish_recommendations(self, ctx: GenContext, items: list[dict[str, str]]) -> Optional[dict[str, dict[str, str]]]:
        """Live only. Returns {id: {title, description}} or None when not live / on any failure
        (the rule-based wording is always a valid fallback, so this never raises)."""
        if not self.live or not items:
            return None
        try:
            out, _, _ = self._run(
                "recommendations", ctx, model_cls=PolishedRecommendations,
                prompt=lambda: prompts.polish_prompts(ctx, items),
                sample_fn=lambda: {"items": []}, in_chars=len(json.dumps(items, default=str)),
            )
        except AIUnavailableError:
            return None
        wanted = {i["id"] for i in items}
        return {p.id: {"title": p.title, "description": p.description} for p in out.items if p.id in wanted}
