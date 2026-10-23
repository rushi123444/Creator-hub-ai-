"""Password hashing (bcrypt) and JWT (HS256) helpers with jti revocation.

The revocation list is an in-memory denylist with expiry pruning. It is DB-independent and is
fine for a single instance; multi-instance deployments should replace it with a shared store
(for example Redis, or a `revoked_tokens` table).
"""
from __future__ import annotations

import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt

from app.config.settings import get_settings

ALGORITHM = "HS256"
_BCRYPT_MAX = 72  # bcrypt only uses the first 72 bytes


def _pw_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX]


def _rounds() -> int:
    """bcrypt cost: always >= 12 in production; BCRYPT_ROUNDS may lower it elsewhere (tests)."""
    if get_settings().is_production:
        return 12
    try:
        return max(4, min(15, int(os.getenv("BCRYPT_ROUNDS", "12"))))
    except ValueError:
        return 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt(rounds=_rounds())).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_pw_bytes(password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# A pre-computed hash used to keep login timing similar for unknown emails.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=_rounds())).decode("utf-8")


def burn_password_check(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def password_strength_problem(password: str) -> Optional[str]:
    """Return a friendly message when the password is too weak, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if len(password) > 128:
        return "Password must be 128 characters or fewer."
    if password.isalpha() or password.isdigit():
        return "Use a mix of letters and numbers (or symbols) in your password."
    return None


# ---- JWT --------------------------------------------------------------------------------------
class TokenDenylist:
    def __init__(self) -> None:
        self._items: dict[str, float] = {}
        self._lock = threading.Lock()

    def revoke(self, jti: str, exp: float) -> None:
        with self._lock:
            self._prune_locked()
            self._items[jti] = exp

    def is_revoked(self, jti: str) -> bool:
        with self._lock:
            exp = self._items.get(jti)
            if exp is None:
                return False
            if exp < time.time():
                self._items.pop(jti, None)
                return False
            return True

    def _prune_locked(self) -> None:
        now = time.time()
        for k in [k for k, e in self._items.items() if e < now]:
            self._items.pop(k, None)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


denylist = TokenDenylist()


def create_access_token(user_id: str, role: str, remember_me: bool = False) -> tuple[str, datetime]:
    s = get_settings()
    minutes = s.jwt_remember_expire_minutes if remember_me else s.jwt_expire_minutes
    expires = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    claims = {"sub": str(user_id), "role": role, "jti": uuid.uuid4().hex, "exp": expires}
    return jwt.encode(claims, s.effective_jwt_secret, algorithm=ALGORITHM), expires


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """Return claims for a valid, unexpired, non-revoked token; otherwise None."""
    try:
        claims = jwt.decode(token, get_settings().effective_jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if not claims.get("sub") or not claims.get("jti") or claims.get("purpose"):
        return None
    if denylist.is_revoked(claims["jti"]):
        return None
    return claims


def revoke_token(claims: dict[str, Any]) -> None:
    denylist.revoke(claims["jti"], float(claims.get("exp", time.time() + 3600)))


# ---- password reset tokens (separate purpose, short lived) -----------------------------------
RESET_PURPOSE = "pwd-reset"


def create_reset_token(user_id: str, password_hash: str, minutes: int = 30) -> str:
    """Reset tokens embed a fingerprint of the current password hash, so they work once only."""
    s = get_settings()
    claims = {
        "sub": str(user_id), "purpose": RESET_PURPOSE, "jti": uuid.uuid4().hex,
        "fp": password_hash[-12:],
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
    }
    return jwt.encode(claims, s.effective_jwt_secret, algorithm=ALGORITHM)


def decode_reset_token(token: str) -> Optional[dict[str, Any]]:
    try:
        claims = jwt.decode(token, get_settings().effective_jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if claims.get("purpose") != RESET_PURPOSE or not claims.get("sub"):
        return None
    return claims
