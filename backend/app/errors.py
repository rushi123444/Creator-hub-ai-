"""Application errors producing the contract section-3 error shape:
{ "error": { "code": "<UPPER_SNAKE>", "message": "<safe, user-friendly>" } }
"""
from __future__ import annotations

from typing import Any, Optional

GENERIC_MESSAGE = "Something went wrong. Please try again."
AI_FAILURE_MESSAGE = "AI generation is temporarily unavailable. Please try again."
LIVE_DATA_MESSAGE = "Live data is temporarily unavailable. Showing available sample insights."


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, fields: Optional[dict[str, Any]] = None,
                 headers: Optional[dict[str, str]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields
        self.headers = headers

    def to_dict(self) -> dict:
        body: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.fields:
            body["fields"] = self.fields
        return {"error": body}


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Please sign in to continue."):
        super().__init__(401, "UNAUTHORIZED", message, headers={"WWW-Authenticate": "Bearer"})


class ForbiddenError(AppError):
    def __init__(self, message: str = "You do not have permission to do that."):
        super().__init__(403, "FORBIDDEN", message)


class NotFoundError(AppError):
    def __init__(self, message: str = "We could not find what you were looking for."):
        super().__init__(404, "NOT_FOUND", message)


class ConflictError(AppError):
    def __init__(self, message: str = "That already exists."):
        super().__init__(409, "CONFLICT", message)


class ValidationFailed(AppError):
    def __init__(self, message: str = "Please check the highlighted fields and try again.",
                 fields: Optional[dict[str, Any]] = None):
        super().__init__(422, "VALIDATION_ERROR", message, fields=fields)


class RateLimitedError(AppError):
    def __init__(self, message: str = "You are doing that too often. Please wait a moment and try again.",
                 retry_after: Optional[int] = None):
        headers = {"Retry-After": str(retry_after)} if retry_after else None
        super().__init__(429, "RATE_LIMITED", message, headers=headers)


class AIUnavailableError(AppError):
    def __init__(self, message: str = AI_FAILURE_MESSAGE):
        super().__init__(503, "AI_UNAVAILABLE", message)


class ServerError(AppError):
    def __init__(self, message: str = GENERIC_MESSAGE):
        super().__init__(500, "SERVER_ERROR", message)
