from fastapi import APIRouter

from app.errors import NotFoundError
from app.models.content import Content
from app.models.system import Report
from app.models.user import EditorProfile, User
from app.routers.deps import CurrentUser, DbSession
from app.schemas.common import iso
from app.schemas.editors import ReportIn

router = APIRouter(prefix="/reports", tags=["reports"])


def report_out(r: Report) -> dict:
    return {"id": str(r.id), "reporter_id": str(r.reporter_id) if r.reporter_id else None,
            "target_type": r.target_type, "target_id": str(r.target_id), "reason": r.reason,
            "details": r.details, "status": r.status, "resolution_note": r.resolution_note,
            "created_at": iso(r.created_at), "updated_at": iso(r.updated_at)}


@router.post("", status_code=201)
def create_report(body: ReportIn, user: CurrentUser, db: DbSession):
    # The target must exist (and users can only report their own content via the content tools).
    if body.target_type == "editor_profile":
        exists = db.get(EditorProfile, body.target_id) is not None
    elif body.target_type == "creator_profile":
        exists = db.get(User, body.target_id) is not None
    else:
        c = db.get(Content, body.target_id)
        exists = c is not None and c.user_id == user.id
    if not exists:
        raise NotFoundError()
    r = Report(reporter_id=user.id, target_type=body.target_type, target_id=body.target_id,
               reason=body.reason, details=body.details, status="open")
    db.add(r)
    db.commit()
    return report_out(r)
