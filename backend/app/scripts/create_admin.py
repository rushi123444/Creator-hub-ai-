"""Create (or promote) an admin account from ADMIN_EMAIL / ADMIN_PASSWORD environment variables.

    ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' python -m app.scripts.create_admin
"""
from __future__ import annotations

import logging
import os
import sys

from sqlalchemy import func, select

from app.database.init_db import create_tables
from app.database.seed import seed_reference
from app.database.session import session_scope
from app.models.user import Profile, User
from app.services import security

logger = logging.getLogger("creatorhub.scripts")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or ""
    name = (os.getenv("ADMIN_NAME") or "Platform Admin").strip()
    if not email or "@" not in email or not password:
        logger.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.")
        return 2
    problem = security.password_strength_problem(password)
    if problem or len(password) < 10:
        logger.error("Admin password rejected: %s", problem or "use at least 10 characters.")
        return 2
    create_tables()
    with session_scope("system") as db:
        seed_reference(db)
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            user = User(email=email, password_hash=security.hash_password(password), full_name=name, role="admin")
            db.add(user)
            db.flush()
            db.add(Profile(user_id=user.id, profile_completed=True))
            logger.info("Admin account created for %s", email)
        else:
            user.role = "admin"
            user.is_active = True
            user.password_hash = security.hash_password(password)
            logger.info("Existing account %s promoted to admin and password updated", email)
    return 0


if __name__ == "__main__":
    sys.exit(main())
