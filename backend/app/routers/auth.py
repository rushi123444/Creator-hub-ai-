from fastapi import APIRouter, Depends, Request

from app.routers.deps import CurrentUser, DbSession, get_token_claims
from app.schemas.auth import ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn
from app.services import auth_service, security
from app.services.rate_limit import login_rate_limit, reset_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201, dependencies=[Depends(reset_rate_limit)])
def register(body: RegisterIn, db: DbSession):
    user = auth_service.register(db, body)
    return auth_service.token_response(user)


@router.post("/login", dependencies=[Depends(login_rate_limit)])
def login(body: LoginIn, db: DbSession):
    user = auth_service.authenticate(db, body.email, body.password)
    return auth_service.token_response(user, body.remember_me)


@router.post("/logout")
def logout(request: Request, user: CurrentUser):
    security.revoke_token(request.state.token_claims)
    return {"ok": True}


@router.post("/forgot-password", dependencies=[Depends(reset_rate_limit)])
def forgot_password(body: ForgotPasswordIn, db: DbSession):
    auth_service.request_password_reset(db, body.email)
    return {"ok": True}


@router.post("/reset-password", dependencies=[Depends(reset_rate_limit)])
def reset_password(body: ResetPasswordIn, db: DbSession):
    auth_service.reset_password(db, body.token, body.new_password)
    return {"ok": True}


@router.get("/me")
def me(user: CurrentUser):
    return auth_service.user_out(user)
