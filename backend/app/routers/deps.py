"""Shared FastAPI dependencies: database session and authentication/authorization."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.database.session import get_db, set_rls_context
from app.errors import ForbiddenError, UnauthorizedError
from app.models.user import User
from app.services.security import decode_token

DbSession = Annotated[Session, Depends(get_db)]


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def get_token_claims(request: Request) -> dict:
    token = _bearer_token(request)
    if not token:
        raise UnauthorizedError()
    claims = decode_token(token)
    if not claims:
        raise UnauthorizedError("Your session has expired. Please sign in again.")
    return claims


def get_current_user(request: Request, db: DbSession) -> User:
    claims = get_token_claims(request)
    try:
        user_id = uuid.UUID(str(claims["sub"]))
    except ValueError:
        raise UnauthorizedError("Your session has expired. Please sign in again.")
    # Identify the actor for RLS before touching user-owned tables.
    set_rls_context(db, str(user_id), str(claims.get("role") or "creator"))
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Your session has expired. Please sign in again.")
    # Role always comes from the database, never from the token alone.
    set_rls_context(db, str(user.id), user.role)
    request.state.user_id = str(user.id)
    request.state.token_claims = claims
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str):
    """Dependency factory: allow only the given roles (others get 403)."""
    allowed = set(roles)

    def _checker(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise ForbiddenError()
        return user

    return _checker


require_admin = require_roles("admin")
AdminUser = Annotated[User, Depends(require_admin)]
CreatorUser = Annotated[User, Depends(require_roles("creator", "admin"))]
EditorUser = Annotated[User, Depends(require_roles("editor", "admin"))]
