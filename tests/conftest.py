"""Shared pytest fixtures. Everything runs against in-memory SQLite (StaticPool) with no network.

Environment is forced BEFORE the app is imported so the app boots in sample mode:
OPENAI_API_KEY / YOUTUBE_API_KEY unset, development env, throw-away JWT secret.
"""
from __future__ import annotations

import os
import sqlite3  # noqa: F401  (backup API used below)
import uuid
from dataclasses import dataclass

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["OPENAI_API_KEY"] = ""
os.environ["YOUTUBE_API_KEY"] = ""
os.environ["AUTO_SEED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-key-for-pytest-only-0123456789abcdef"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["LOG_LEVEL"] = "WARNING"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.config.settings import reset_settings_cache  # noqa: E402

reset_settings_cache()

from app.database import session as session_module  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.database.seed import seed_all  # noqa: E402
from app.database.session import get_db, make_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.user import CreatorProfile, EditorProfile, Profile, User  # noqa: E402
from app.services.rate_limit import reset_rate_limits  # noqa: E402
from app.services.security import create_access_token, denylist, hash_password  # noqa: E402

DEMO = {
    "creator": ("creator@creatorhub.ai", "Creator@123"),
    "editor": ("editor@creatorhub.ai", "Editor@123"),
    "admin": ("admin@creatorhub.ai", "Admin@12345"),
}


@pytest.fixture(scope="session")
def _template_engine():
    """Seed once; every test gets a fast byte-for-byte copy via SQLite's backup API."""
    eng = make_engine("sqlite://")
    Base.metadata.create_all(eng)
    with Session(eng, expire_on_commit=False) as s:
        seed_all(s, include_demo_accounts=True)
        s.commit()
    return eng


@pytest.fixture(autouse=True)
def _clean_state():
    reset_rate_limits()
    denylist.clear()
    yield


@pytest.fixture()
def engine(_template_engine, monkeypatch):
    eng = make_engine("sqlite://")
    src = _template_engine.raw_connection()
    dst = eng.raw_connection()
    src.driver_connection.backup(dst.driver_connection)
    original_bind = session_module.SessionLocal.kw.get("bind")
    monkeypatch.setattr(session_module, "engine", eng)
    session_module.SessionLocal.configure(bind=eng)
    yield eng
    session_module.SessionLocal.configure(bind=original_bind)
    eng.dispose()


@pytest.fixture()
def db(engine):
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def app(engine):
    application = create_app()
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _override():
        s = factory()
        try:
            yield s
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    application.dependency_overrides[get_db] = _override
    return application


@pytest.fixture()
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def _headers_for(db: Session, email: str) -> dict:
    user = db.scalar(select(User).where(User.email == email))
    assert user is not None, f"seed user {email} missing"
    token, _ = create_access_token(str(user.id), user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def creator_headers(db):
    return _headers_for(db, DEMO["creator"][0])


@pytest.fixture()
def editor_headers(db):
    return _headers_for(db, DEMO["editor"][0])


@pytest.fixture()
def admin_headers(db):
    return _headers_for(db, DEMO["admin"][0])


@dataclass
class MadeUser:
    id: str
    email: str
    password: str
    role: str
    headers: dict


@pytest.fixture()
def make_user(db):
    """Create an extra user directly in the DB. `make_user("creator")` -> MadeUser."""
    def _make(role: str = "creator", *, full_name: str | None = None, completed: bool = False) -> MadeUser:
        email = f"{role}.{uuid.uuid4().hex[:8]}@example.com"
        password = "Test@12345"
        user = User(email=email, password_hash=hash_password(password),
                    full_name=full_name or f"Test {role.title()}", role=role)
        db.add(user)
        db.flush()
        db.add(Profile(user_id=user.id, profile_completed=completed))
        if role == "creator":
            db.add(CreatorProfile(user_id=user.id, interests=[]))
        db.commit()
        token, _ = create_access_token(str(user.id), role)
        return MadeUser(str(user.id), email, password, role, {"Authorization": f"Bearer {token}"})

    return _make


def demo_user_id(db: Session, role: str) -> str:
    return str(db.scalar(select(User.id).where(User.email == DEMO[role][0])))


def editor_profile_count(db: Session) -> int:
    return len(db.scalars(select(EditorProfile.id)).all())
