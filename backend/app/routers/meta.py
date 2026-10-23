from fastapi import APIRouter
from sqlalchemy import select

from app.models.reference import Category, Language, Platform
from app.routers.deps import DbSession
from app.schemas.common import CONTENT_STATUSES, CONTENT_TYPES, SPECIALIZATIONS, TONES

router = APIRouter(tags=["meta"])


@router.get("/meta")
def meta(db: DbSession):
    cats = db.scalars(select(Category).where(Category.is_active.is_(True)).order_by(Category.id)).all()
    langs = db.scalars(select(Language).where(Language.is_active.is_(True)).order_by(Language.code)).all()
    plats = db.scalars(select(Platform).where(Platform.is_active.is_(True)).order_by(Platform.id)).all()
    return {
        "categories": [{"id": c.id, "name": c.name, "slug": c.slug} for c in cats],
        "languages": [{"code": l.code, "name": l.name, "native_name": l.native_name} for l in langs],
        "platforms": [{"id": p.id, "slug": p.slug, "name": p.name} for p in plats],
        "content_types": list(CONTENT_TYPES),
        "tones": list(TONES),
        "statuses": list(CONTENT_STATUSES),
        "specializations": list(SPECIALIZATIONS),
    }
