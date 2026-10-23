"""FastAPI application factory."""
from __future__ import annotations

import importlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config.settings import configure_logging, get_settings
from app.errors import GENERIC_MESSAGE, AppError

logger = logging.getLogger("creatorhub")
API_PREFIX = "/api/v1"

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}

_HTTP_CODES = {400: "VALIDATION_ERROR", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND",
               405: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION_ERROR", 429: "RATE_LIMITED"}
_HTTP_MESSAGES = {401: "Please sign in to continue.", 403: "You do not have permission to do that.",
                  404: "We could not find what you were looking for.",
                  405: "We could not find what you were looking for."}


def _error(status: int, code: str, message: str, fields=None, headers=None) -> JSONResponse:
    body = {"code": code, "message": message}
    if fields:
        body["fields"] = fields
    return JSONResponse(status_code=status, content={"error": body}, headers=headers)


def _register_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return _error(exc.status_code, exc.code, exc.message, exc.fields, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        fields: dict[str, str] = {}
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path")]
            msg = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
            fields[".".join(loc) or "request"] = msg[:200]
        return _error(422, "VALIDATION_ERROR", "Please check the highlighted fields and try again.", fields)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = _HTTP_CODES.get(exc.status_code, "SERVER_ERROR" if exc.status_code >= 500 else "VALIDATION_ERROR")
        message = _HTTP_MESSAGES.get(exc.status_code, GENERIC_MESSAGE)
        status = 404 if exc.status_code == 405 else exc.status_code
        return _error(status, code, message)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
        return _error(500, "SERVER_ERROR", GENERIC_MESSAGE)


def _include_core(app: FastAPI) -> None:
    from app.routers import (admin, auth, calendar, content, editors, health, ideas, meta, notifications,
                             profiles, reports)

    app.include_router(health.router)
    for module in (auth, profiles, meta, content, calendar, ideas, editors, notifications, reports, admin):
        app.include_router(module.router, prefix=API_PREFIX)


def _include_intel(app: FastAPI) -> None:
    # INTEL-ROUTERS ---------------------------------------------------------------------------
    # Owned by BACKEND-INTEL. A guarded import loop keeps the app booting while those modules are
    # still being finished; a missing module logs an ERROR. At integration this becomes explicit
    # imports + include_router calls.
    for name in ("ai", "trends", "analytics", "recommendations", "competitors", "dashboard"):
        try:
            module = importlib.import_module(f"app.routers.{name}")
            app.include_router(module.router, prefix=API_PREFIX)
        except ImportError:
            logger.error("Router app.routers.%s is not available; its endpoints are disabled.", name)
    # END INTEL-ROUTERS -----------------------------------------------------------------------


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        settings.validate_startup()  # raises (production only) after logging technical reasons
        from app.database.init_db import init_db

        init_db()
        yield

    app = FastAPI(
        title="CreatorHub AI API", version="1.0.0", lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None, openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"], max_age=600,
    )

    @app.middleware("http")
    async def _security_headers(request: Request, call_next):
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        if request.url.path.startswith(API_PREFIX):
            response.headers.setdefault("Cache-Control", "no-store")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    _register_handlers(app)
    _include_core(app)
    _include_intel(app)
    return app


app = create_app()
