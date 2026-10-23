"""Saved AI output: ideas, hooks, captions, hashtags, scripts (POST/GET/DELETE) + script save-to-content."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.errors import NotFoundError
from app.models.content import Caption, Content, ContentIdea, Hashtag, Hook, Script
from app.routers.deps import CurrentUser, DbSession
from app.schemas.common import iso
from app.schemas.content import CaptionIn, HashtagIn, HookIn, IdeaIn, ScriptIn, ScriptToContentIn
from app.services import content_service as svc, lookup

router = APIRouter(tags=["saved"])


def _owned(db, model, user_id, item_id):
    try:
        iid = uuid.UUID(str(item_id))
    except ValueError:
        raise NotFoundError()
    row = db.scalar(select(model).where(model.id == iid, model.user_id == user_id))
    if row is None:
        raise NotFoundError()
    return row


def _list(db, model, user_id, limit, offset, out):
    total = db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id)) or 0
    rows = db.scalars(select(model).where(model.user_id == user_id).order_by(model.created_at.desc())
                      .limit(limit).offset(offset)).all()
    return {"items": [out(r) for r in rows], "total": total}


def _own_content_id(db, user_id, content_id) -> Optional[uuid.UUID]:
    return svc.get_owned_content(db, user_id, content_id).id if content_id else None


# ---- outputs ----
def idea_out(db, r):
    return {"id": str(r.id), "title": r.title, "topic": r.topic, "format": r.format, "reason": r.reason,
            "suggested_hook": r.suggested_hook, "category": lookup.category_name(db, r.category_id),
            "platform": lookup.platform_slug(db, r.platform_id), "language": r.language_code,
            "created_at": iso(r.created_at)}


def hook_out(db, r):
    return {"id": str(r.id), "hook_type": r.hook_type, "type": r.hook_type, "text": r.text, "topic": r.topic,
            "content_id": str(r.content_id) if r.content_id else None,
            "platform": lookup.platform_slug(db, r.platform_id), "language": r.language_code,
            "created_at": iso(r.created_at)}


def caption_out(db, r):
    return {"id": str(r.id), "instagram_caption": r.instagram_caption, "youtube_description": r.youtube_description,
            "short_description": r.short_description, "cta": r.cta, "keywords": list(r.keywords or []),
            "topic": r.topic, "content_id": str(r.content_id) if r.content_id else None,
            "platform": lookup.platform_slug(db, r.platform_id), "language": r.language_code,
            "created_at": iso(r.created_at)}


def hashtag_out(db, r):
    return {"id": str(r.id), "broad": list(r.broad or []), "medium": list(r.medium or []), "niche": list(r.niche or []),
            "topic": r.topic, "content_id": str(r.content_id) if r.content_id else None,
            "platform": lookup.platform_slug(db, r.platform_id), "language": r.language_code,
            "created_at": iso(r.created_at)}


def script_out(db, r):
    return {"id": str(r.id), "topic": r.topic, "hook": r.hook, "introduction": r.introduction,
            "main_points": list(r.main_points or []), "examples": list(r.examples or []), "cta": r.cta,
            "ending": r.ending, "full_script": r.full_script,
            "content_id": str(r.content_id) if r.content_id else None,
            "platform": lookup.platform_slug(db, r.platform_id), "language": r.language_code,
            "duration_seconds": r.duration_seconds, "tone": r.tone, "created_at": iso(r.created_at)}



# ---- ideas ----
@router.get("/ideas")
def list_ideas(user: CurrentUser, db: DbSession, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return _list(db, ContentIdea, user.id, limit, offset, lambda r: idea_out(db, r))


@router.post("/ideas", status_code=201)
def save_idea(body: IdeaIn, user: CurrentUser, db: DbSession):
    r = ContentIdea(user_id=user.id, title=body.title, topic=body.topic, format=body.format, reason=body.reason,
                    suggested_hook=body.suggested_hook, category_id=svc.resolve_category(db, body.category),
                    platform_id=svc.resolve_platform(db, body.platform), language_code=body.language or "en")
    db.add(r)
    db.commit()
    return idea_out(db, r)


@router.delete("/ideas/{item_id}")
def delete_idea(item_id: str, user: CurrentUser, db: DbSession):
    db.delete(_owned(db, ContentIdea, user.id, item_id))
    db.commit()
    return {"ok": True}


# ---- hooks ----
@router.get("/hooks")
def list_hooks(user: CurrentUser, db: DbSession, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return _list(db, Hook, user.id, limit, offset, lambda r: hook_out(db, r))


@router.post("/hooks", status_code=201)
def save_hook(body: HookIn, user: CurrentUser, db: DbSession):
    r = Hook(user_id=user.id, hook_type=body.hook_type, text=body.text, topic=body.topic,
             content_id=_own_content_id(db, user.id, body.content_id),
             platform_id=svc.resolve_platform(db, body.platform), language_code=body.language or "en")
    db.add(r)
    db.commit()
    return hook_out(db, r)


@router.delete("/hooks/{item_id}")
def delete_hook(item_id: str, user: CurrentUser, db: DbSession):
    db.delete(_owned(db, Hook, user.id, item_id))
    db.commit()
    return {"ok": True}


# ---- captions ----
@router.get("/captions")
def list_captions(user: CurrentUser, db: DbSession, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return _list(db, Caption, user.id, limit, offset, lambda r: caption_out(db, r))


@router.post("/captions", status_code=201)
def save_caption(body: CaptionIn, user: CurrentUser, db: DbSession):
    r = Caption(user_id=user.id, instagram_caption=body.instagram_caption, youtube_description=body.youtube_description,
                short_description=body.short_description, cta=body.cta, keywords=body.keywords, topic=body.topic,
                content_id=_own_content_id(db, user.id, body.content_id),
                platform_id=svc.resolve_platform(db, body.platform), language_code=body.language or "en")
    db.add(r)
    db.commit()
    return caption_out(db, r)


@router.delete("/captions/{item_id}")
def delete_caption(item_id: str, user: CurrentUser, db: DbSession):
    db.delete(_owned(db, Caption, user.id, item_id))
    db.commit()
    return {"ok": True}


# ---- hashtags ----
@router.get("/hashtags")
def list_hashtags(user: CurrentUser, db: DbSession, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return _list(db, Hashtag, user.id, limit, offset, lambda r: hashtag_out(db, r))


@router.post("/hashtags", status_code=201)
def save_hashtags(body: HashtagIn, user: CurrentUser, db: DbSession):
    r = Hashtag(user_id=user.id, broad=body.broad, medium=body.medium, niche=body.niche, topic=body.topic,
                content_id=_own_content_id(db, user.id, body.content_id),
                platform_id=svc.resolve_platform(db, body.platform), language_code=body.language or "en")
    db.add(r)
    db.commit()
    return hashtag_out(db, r)


@router.delete("/hashtags/{item_id}")
def delete_hashtags(item_id: str, user: CurrentUser, db: DbSession):
    db.delete(_owned(db, Hashtag, user.id, item_id))
    db.commit()
    return {"ok": True}


# ---- scripts ----
@router.get("/scripts")
def list_scripts(user: CurrentUser, db: DbSession, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return _list(db, Script, user.id, limit, offset, lambda r: script_out(db, r))


@router.post("/scripts", status_code=201)
def save_script(body: ScriptIn, user: CurrentUser, db: DbSession):
    r = Script(user_id=user.id, topic=body.topic, hook=body.hook, introduction=body.introduction,
               main_points=body.main_points, examples=body.examples, cta=body.cta, ending=body.ending,
               full_script=body.full_script, content_id=_own_content_id(db, user.id, body.content_id),
               platform_id=svc.resolve_platform(db, body.platform), language_code=body.language or "en",
               duration_seconds=body.duration_seconds, tone=body.tone)
    db.add(r)
    db.commit()
    return script_out(db, r)


@router.delete("/scripts/{item_id}")
def delete_script(item_id: str, user: CurrentUser, db: DbSession):
    db.delete(_owned(db, Script, user.id, item_id))
    db.commit()
    return {"ok": True}


@router.post("/scripts/{item_id}/save-to-content", status_code=201)
def script_to_content(item_id: str, user: CurrentUser, db: DbSession, body: Optional[ScriptToContentIn] = None):
    s = _owned(db, Script, user.id, item_id)
    body = body or ScriptToContentIn()
    text = s.full_script or "\n\n".join(x for x in [s.hook, s.introduction, *(s.main_points or []), s.cta, s.ending] if x)
    c = Content(user_id=user.id, title=(body.title or s.topic or "Untitled script")[:200], topic=s.topic,
                content_type=body.content_type, platform_id=s.platform_id, language_code=s.language_code,
                status="script", body=text or None, ai_generated=True, hashtags=[])
    db.add(c)
    db.flush()
    s.content_id = c.id
    db.commit()
    return svc.content_out(db, c)
