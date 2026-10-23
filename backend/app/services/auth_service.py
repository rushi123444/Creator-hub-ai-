"""Registration, login, password reset and user serialisation."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.database.session import set_rls_context
from app.errors import ConflictError, ForbiddenError, UnauthorizedError, ValidationFailed
from app.models.system import PlatformSetting
from app.models.user import CreatorProfile, Profile, User
from app.schemas.auth import RegisterIn
from app.services import security
from app.services.notification_service import notify

logger = logging.getLogger("creatorhub.auth")
BAD_LOGIN = "Incorrect email or password."


def user_out(user: User) -> dict:
    p = user.profile
    cp = user.creator_profile
    return {
        "id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role,
        "profile": {
            "username": p.username if p else None,
            "avatar_url": p.avatar_url if p else None,
            "bio": p.bio if p else None,
            "preferred_language": p.preferred_language if p else "en",
            "ui_language": p.ui_language if p else "en",
            "profile_completed": bool(p.profile_completed) if p else False,
        },
        "creator_profile": None if cp is None else {
            "category_id": cp.category_id, "platform_id": cp.platform_id,
            "creator_type": cp.creator_type, "experience_level": cp.experience_level,
            "interests": list(cp.interests or []), "default_tone": cp.default_tone,
        },
    }


def registration_open(db: Session) -> bool:
    row = db.get(PlatformSetting, "open_registration")
    if row is None:
        return True
    v = row.value.get("value") if isinstance(row.value, dict) else row.value
    return bool(v) if v is not None else True


def token_response(user: User, remember_me: bool = False) -> dict:
    token, _ = security.create_access_token(str(user.id), user.role, remember_me)
    return {"access_token": token, "token_type": "bearer", "user": user_out(user)}


def register(db: Session, data: RegisterIn) -> User:
    set_rls_context(db, None, "system")
    if not registration_open(db):
        raise ForbiddenError("Registration is currently closed. Please try again later.")
    problem = security.password_strength_problem(data.password)
    if problem:
        raise ValidationFailed(problem, fields={"password": problem})
    if db.scalar(select(User.id).where(func.lower(User.email) == data.email)):
        raise ConflictError("An account with this email already exists.")
    user = User(email=data.email, password_hash=security.hash_password(data.password),
                full_name=data.full_name.strip(), role=data.role)
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id, profile_completed=False))
    if data.role == "creator":
        db.add(CreatorProfile(user_id=user.id, interests=[]))
    notify(db, user.id, "Welcome to CreatorHub AI",
           "Complete your profile to get personalised ideas and trends.", "welcome",
           "/app/profile/setup" if data.role == "creator" else "/app/editor-profile")
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    set_rls_context(db, None, "system")
    user = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
    if user is None:
        security.burn_password_check(password)
        raise UnauthorizedError(BAD_LOGIN)
    if not security.verify_password(password, user.password_hash) or not user.is_active:
        raise UnauthorizedError(BAD_LOGIN)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return user


def request_password_reset(db: Session, email: str) -> None:
    """Never reveals whether the account exists. The token is only logged server-side (dev/demo)."""
    set_rls_context(db, None, "system")
    user = db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))
    if user is None or not user.is_active:
        return
    token = security.create_reset_token(str(user.id), user.password_hash)
    if not get_settings().is_production:
        logger.warning("Password reset token for %s (dev/demo only; email delivery not implemented): %s",
                       user.email, token)
    else:
        logger.info("Password reset requested for a user; email delivery is not configured.")


def reset_password(db: Session, token: str, new_password: str) -> None:
    set_rls_context(db, None, "system")
    invalid = ValidationFailed("This reset link is invalid or has expired. Please request a new one.")
    claims = security.decode_reset_token(token)
    if not claims:
        raise invalid
    import uuid
    try:
        user = db.get(User, uuid.UUID(str(claims["sub"])))
    except ValueError:
        raise invalid
    if user is None or not user.is_active or claims.get("fp") != user.password_hash[-12:]:
        raise invalid
    problem = security.password_strength_problem(new_password)
    if problem:
        raise ValidationFailed(problem, fields={"new_password": problem})
    user.password_hash = security.hash_password(new_password)
    db.commit()
