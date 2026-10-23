"""Engine, session factory, FastAPI dependency and Row Level Security context helper."""
from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.settings import get_settings

logger = logging.getLogger("creatorhub.db")


def normalize_database_url(url: str) -> str:
    """Make `postgres://` / `postgresql://` URLs use the installed psycopg (v3) driver."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def make_engine(url: Optional[str] = None) -> Engine:
    url = normalize_database_url(url or get_settings().effective_database_url)
    parsed = make_url(url)
    if parsed.get_backend_name() == "sqlite":
        kwargs: dict = {"connect_args": {"check_same_thread": False}}
        if parsed.database in (None, "", ":memory:"):
            kwargs["poolclass"] = StaticPool  # one shared in-memory connection
        eng = create_engine(url, **kwargs)

        @event.listens_for(eng, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover - trivial
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

        return eng
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


engine: Engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def is_postgres(bind) -> bool:
    try:
        return bind.dialect.name == "postgresql"
    except AttributeError:
        return False


def _apply_rls(db: Session, user_id: Optional[str], role: str) -> None:
    db.execute(
        text("SELECT set_config('app.current_user_id', :uid, true), set_config('app.current_role', :role, true)"),
        {"uid": user_id or "", "role": role},
    )


def set_rls_context(db: Session, user_id: Optional[str], role: str) -> None:
    """Tell PostgreSQL who is acting so RLS policies can apply (no-op on SQLite).

    The values are transaction-local, so they are remembered on the session and re-applied
    after every commit (see the `after_begin` hook below).
    """
    db.info["rls_context"] = (str(user_id) if user_id else None, role)
    if is_postgres(db.get_bind()):
        _apply_rls(db, db.info["rls_context"][0], role)


@event.listens_for(Session, "after_begin")
def _reapply_rls(session: Session, transaction, connection) -> None:
    ctx = session.info.get("rls_context")
    if ctx and is_postgres(connection):
        connection.execute(
            text("SELECT set_config('app.current_user_id', :uid, true), set_config('app.current_role', :role, true)"),
            {"uid": ctx[0] or "", "role": ctx[1]},
        )


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def session_scope(role: str = "system", user_id: Optional[str] = None) -> Iterator[Session]:
    """Transactional scope for scripts, startup tasks and seeding. Defaults to the `system` RLS role."""
    db = SessionLocal()
    try:
        set_rls_context(db, user_id, role)
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
