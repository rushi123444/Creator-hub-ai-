"""Editor profile serialisation and persistence shared by the directory and admin routers."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.models.user import EditorProfile, EditorSkill


def editor_out(e: EditorProfile) -> dict:
    return {
        "id": str(e.id), "display_name": e.display_name, "headline": e.headline,
        "specialization": e.specialization, "skills": [s.skill for s in e.skills],
        "languages": list(e.languages or []), "experience_years": e.experience_years,
        "portfolio_url": e.portfolio_url, "instagram_url": e.instagram_url, "contact_email": e.contact_email,
        "avatar_url": e.avatar_url, "bio": e.bio, "is_verified": e.is_verified,
    }


def admin_editor_out(e: EditorProfile) -> dict:
    return {**editor_out(e), "status": e.status, "user_id": str(e.user_id) if e.user_id else None}


def set_skills(e: EditorProfile, skills: list[str]) -> None:
    e.skills.clear()
    for s in skills:
        e.skills.append(EditorSkill(skill=s))


def get_editor(db: Session, editor_id) -> EditorProfile:
    try:
        eid = uuid.UUID(str(editor_id))
    except ValueError:
        raise NotFoundError()
    e = db.get(EditorProfile, eid)
    if e is None:
        raise NotFoundError()
    return e
