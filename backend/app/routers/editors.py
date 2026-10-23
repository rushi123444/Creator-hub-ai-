from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.errors import NotFoundError
from app.models.user import EditorProfile, EditorSkill
from app.routers.deps import DbSession, CurrentUser, EditorUser
from app.schemas.editors import EditorSelfIn
from app.services import editor_service as svc

router = APIRouter(prefix="/editors", tags=["editors"])


@router.get("")
def directory(user: CurrentUser, db: DbSession, q: Optional[str] = Query(None, max_length=100),
              specialization: Optional[str] = Query(None, max_length=30), language: Optional[str] = Query(None, max_length=5),
              limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    sel = select(EditorProfile).where(EditorProfile.status == "active")
    if specialization:
        sel = sel.where(EditorProfile.specialization == specialization)
    if q:
        like = f"%{q.strip().lower()}%"
        skill_ids = select(EditorSkill.editor_id).where(func.lower(EditorSkill.skill).like(like))
        sel = sel.where(or_(func.lower(EditorProfile.display_name).like(like),
                            func.lower(func.coalesce(EditorProfile.headline, "")).like(like),
                            EditorProfile.id.in_(skill_ids)))
    rows = db.scalars(sel.order_by(EditorProfile.is_verified.desc(), EditorProfile.display_name)).all()
    if language:
        rows = [r for r in rows if language.lower() in (r.languages or [])]
    total = len(rows)
    return {"items": [svc.editor_out(r) for r in rows[offset:offset + limit]], "total": total}


@router.get("/me/profile")
def my_profile(user: EditorUser, db: DbSession):
    e = db.scalar(select(EditorProfile).where(EditorProfile.user_id == user.id))
    if e is None:
        raise NotFoundError("You have not created your editor profile yet.")
    return {**svc.editor_out(e), "status": e.status}


@router.put("/me/profile")
def save_my_profile(body: EditorSelfIn, user: EditorUser, db: DbSession):
    e = db.scalar(select(EditorProfile).where(EditorProfile.user_id == user.id))
    if e is None:
        e = EditorProfile(user_id=user.id, display_name=body.display_name, specialization=body.specialization,
                          languages=[], status="active")
        db.add(e)
    for k in ("display_name", "headline", "specialization", "languages", "experience_years", "portfolio_url",
              "instagram_url", "contact_email", "avatar_url", "bio"):
        setattr(e, k, getattr(body, k))
    svc.set_skills(e, body.skills)
    db.commit()
    db.refresh(e)
    return {**svc.editor_out(e), "status": e.status}


@router.get("/{editor_id}")
def detail(editor_id: str, user: CurrentUser, db: DbSession):
    e = svc.get_editor(db, editor_id)
    if e.status != "active" and e.user_id != user.id:
        raise NotFoundError()
    return svc.editor_out(e)
