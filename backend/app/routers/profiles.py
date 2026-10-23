from fastapi import APIRouter
from sqlalchemy import select

from app.errors import ConflictError, ValidationFailed
from app.models.user import CreatorProfile, Profile
from app.routers.deps import CurrentUser, DbSession
from app.schemas.auth import ProfileUpdateIn
from app.services import auth_service, content_service

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me")
def get_me(user: CurrentUser):
    return auth_service.user_out(user)


@router.put("/me")
def update_me(body: ProfileUpdateIn, user: CurrentUser, db: DbSession):
    f = body.model_fields_set
    if user.profile is None:
        user.profile = Profile(user_id=user.id)
        db.flush()
    p = user.profile
    if "full_name" in f and body.full_name:
        user.full_name = body.full_name
    if "username" in f:
        if body.username:
            taken = db.scalar(select(Profile.id).where(Profile.username == body.username, Profile.user_id != user.id))
            if taken:
                raise ConflictError("That username is already taken.")
        p.username = body.username
    for k in ("avatar_url", "bio", "preferred_language", "ui_language"):
        if k in f and (getattr(body, k) is not None or k in ("avatar_url", "bio")):
            setattr(p, k, getattr(body, k))
    if user.role == "creator" or {"category", "category_id", "platform", "platform_id", "creator_type",
                                  "experience_level", "interests", "default_tone"} & f:
        cp = user.creator_profile
        if cp is None:
            cp = CreatorProfile(user_id=user.id, interests=[])
            db.add(cp)
            user.creator_profile = cp
        if "category" in f or "category_id" in f:
            ref = body.category if "category" in f and body.category is not None else body.category_id
            cp.category_id = content_service.resolve_category(db, ref)
        if "platform" in f or "platform_id" in f:
            ref = body.platform if "platform" in f and body.platform is not None else body.platform_id
            cp.platform_id = content_service.resolve_platform(db, ref)
        for k in ("creator_type", "experience_level", "default_tone"):
            if k in f:
                setattr(cp, k, getattr(body, k))
        if "interests" in f and body.interests is not None:
            cp.interests = body.interests
    # profile is complete once the essentials are present
    if user.role == "creator":
        cp = user.creator_profile
        p.profile_completed = bool(cp and cp.category_id and cp.platform_id and p.preferred_language)
    else:
        p.profile_completed = bool(user.full_name)
    db.commit()
    db.refresh(user)
    return auth_service.user_out(user)
