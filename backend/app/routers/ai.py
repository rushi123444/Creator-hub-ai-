"""AI routes (contract section 5). Every route is rate limited and goes through AIService."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.ai.context import normalise_platform
from app.ai.service import AIService
from app.models.user import User
from app.routers.deps import DbSession
from app.schemas.ai import (
    AssistantRequest, AssistantResponse, CaptionResponse, ClassifyRequest, ClassifyResponse, GenerateRequest,
    GenerateResponse, HashtagsResponse, HooksResponse, IdeasResponse, LongToShortRequest, LongToShortResponse,
    RegenerateRequest, RegenerateResponse, ScriptResponse, SummarizeRequest, SummarizeResponse,
)
from app.services.rate_limit import ai_rate_limit

router = APIRouter(prefix="/ai", tags=["ai"])
RateLimitedUser = Annotated[User, Depends(ai_rate_limit)]


def _svc(db, user) -> AIService:
    return AIService(db, user)


@router.post("/generate", response_model=GenerateResponse)
def generate(body: GenerateRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.generate(svc.context(body))
    return {**r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/hooks", response_model=HooksResponse)
def hooks(body: GenerateRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.hooks(svc.context(body))
    return {"hooks": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/script", response_model=ScriptResponse)
def script(body: GenerateRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.script(svc.context(body))
    return {"script": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/caption", response_model=CaptionResponse)
def caption(body: GenerateRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.caption(svc.context(body))
    return {"caption": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/hashtags", response_model=HashtagsResponse)
def hashtags(body: GenerateRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.hashtags(svc.context(body))
    return {"hashtags": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/ideas", response_model=IdeasResponse)
def ideas(body: GenerateRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.ideas(svc.context(body))
    return {"ideas": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/regenerate", response_model=RegenerateResponse)
def regenerate(body: RegenerateRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.regenerate(body.section, svc.context(body.params), hook_type=body.hook_type, current=body.current)
    return {"section": body.section, "value": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/assistant", response_model=AssistantResponse)
def assistant(body: AssistantRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    ctx = svc.context({}, language=body.language)
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    r = svc.assistant(ctx, messages)
    return {"message": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/long-to-short", response_model=LongToShortResponse)
def long_to_short(body: LongToShortRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    platform = normalise_platform(body.target_platform, default="instagram")
    ctx = svc.context({"platform": platform}, language=body.language)
    seconds = body.target_duration_seconds or 45
    r = svc.long_to_short(ctx, body.source_text, ctx.platform_label, seconds)
    return {"shorts": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/summarize", response_model=SummarizeResponse)
def summarize(body: SummarizeRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.summarize(svc.context({}, language=body.language), body.text)
    return {"summary": r.value, "is_sample": r.is_sample, "model": r.model}


@router.post("/classify-topic", response_model=ClassifyResponse)
def classify_topic(body: ClassifyRequest, user: RateLimitedUser, db: DbSession):
    svc = _svc(db, user)
    r = svc.classify_topic(svc.context({}), body.text)
    return {**r.value, "is_sample": r.is_sample, "model": r.model}
