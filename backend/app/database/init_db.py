"""Create tables and run the first-time seed when allowed."""
from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import app.models  # noqa: F401  (register all tables on Base.metadata)
from app.config.settings import get_settings
from app.database import session as session_module
from app.database.base import Base
from app.models.reference import Category

logger = logging.getLogger("creatorhub.db")


def create_tables() -> None:
    Base.metadata.create_all(session_module.engine)


def database_is_empty(db: Session) -> bool:
    return (db.scalar(select(func.count()).select_from(Category)) or 0) == 0


def init_db() -> None:
    """create_all, then seed if AUTO_SEED is on and the database is empty.

    Production never gets demo accounts, even with AUTO_SEED=true (reference data only).
    """
    settings = get_settings()
    create_tables()
    if not settings.auto_seed:
        return
    from app.database.seed import seed_all

    with session_module.session_scope("system") as db:
        if not database_is_empty(db):
            return
        logger.info("Empty database detected: seeding initial data.")
        seed_all(db, include_demo_accounts=not settings.is_production)
