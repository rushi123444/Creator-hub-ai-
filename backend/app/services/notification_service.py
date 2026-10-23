"""Notification helpers."""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.system import Notification
from app.schemas.common import iso


def notify(db: Session, user_id, title: str, body: Optional[str] = None, kind: str = "info",
           link: Optional[str] = None) -> Notification:
    n = Notification(user_id=user_id, title=title[:160], body=body, kind=kind[:30], link=link)
    db.add(n)
    return n


def notification_out(n: Notification) -> dict:
    return {"id": str(n.id), "title": n.title, "body": n.body, "kind": n.kind, "link": n.link,
            "is_read": n.is_read, "created_at": iso(n.created_at)}


def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
    res = db.execute(update(Notification).where(Notification.user_id == user_id,
                                                Notification.is_read.is_(False)).values(is_read=True))
    db.commit()
    return res.rowcount or 0
