"""Rate limiting.

- `ai_rate_limit`: FastAPI dependency; per-minute (in memory, sliding window) and per-day
  (counted from the `ai_requests` table, so it survives restarts) limits per user.
- `login_rate_limiter`: 10 attempts / minute / client IP.

The in-memory windows are per process. Multi-instance deployments should move them to a shared
store such as Redis.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from datetime import datetime, time as dtime, timezone
from typing import Deque

from fastapi import Depends, Request
from sqlalchemy import func, select

from app.config.settings import get_settings
from app.errors import RateLimitedError
from app.models.system import AIRequest, PlatformSetting
from app.models.user import User
from app.routers.deps import CurrentUser, DbSession


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: int = 60):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int | None = None) -> int | None:
        """Register a hit. Returns None if allowed, else the seconds to wait."""
        limit = self.limit if limit is None else limit
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= limit:
                return max(1, int(self.window - (now - q[0])) + 1)
            q.append(now)
            if len(self._hits) > 5000:  # opportunistic cleanup of idle keys
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] >= self.window]:
                    self._hits.pop(k, None)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


_ai_minute = SlidingWindowLimiter(limit=20, window_seconds=60)
login_limiter = SlidingWindowLimiter(limit=10, window_seconds=60)
_reset_limiter = SlidingWindowLimiter(limit=10, window_seconds=60)


def reset_rate_limits() -> None:
    """Test helper."""
    _ai_minute.reset()
    login_limiter.reset()
    _reset_limiter.reset()


def client_ip(request: Request) -> str:
    # Only trust X-Forwarded-For's first hop; proxies in front of the app should set it.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64] or "unknown"
    return request.client.host if request.client else "unknown"


def login_rate_limit(request: Request) -> None:
    wait = login_limiter.hit(client_ip(request))
    if wait:
        raise RateLimitedError("Too many attempts. Please wait a minute and try again.", retry_after=wait)


def reset_rate_limit(request: Request) -> None:
    wait = _reset_limiter.hit(client_ip(request))
    if wait:
        raise RateLimitedError("Too many attempts. Please wait a minute and try again.", retry_after=wait)


def effective_daily_limit(db) -> int:
    """Admin-editable `ai_daily_limit_per_user` setting, falling back to the environment default."""
    default = get_settings().ai_daily_limit_per_user
    row = db.get(PlatformSetting, "ai_daily_limit_per_user")
    if row is not None:
        value = row.value.get("value") if isinstance(row.value, dict) else row.value
        try:
            n = int(value)
            if n > 0:
                return n
        except (TypeError, ValueError):
            pass
    return default


def ai_rate_limit(user: CurrentUser, db: DbSession) -> User:
    """Dependency for every AI route. Raises 429 RATE_LIMITED (friendly message) when exceeded."""
    settings = get_settings()
    wait = _ai_minute.hit(str(user.id), settings.ai_rate_limit_per_minute)
    if wait:
        raise RateLimitedError(
            "You are generating content very quickly. Please wait a moment and try again.",
            retry_after=wait,
        )
    start = datetime.combine(datetime.now(timezone.utc).date(), dtime.min, tzinfo=timezone.utc)
    used = db.scalar(
        select(func.count()).select_from(AIRequest).where(
            AIRequest.user_id == user.id, AIRequest.created_at >= start
        )
    ) or 0
    if used >= effective_daily_limit(db):
        raise RateLimitedError("You have reached today's AI generation limit. Please try again tomorrow.")
    return user
