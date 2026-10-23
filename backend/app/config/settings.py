"""Application settings and environment validation (contract section 2).

Missing optional integrations (OpenAI / YouTube / Supabase) never stop the app; they only switch
features to sample mode. In production, unsafe configuration is logged (technical reason, server
side only) and startup is refused.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("creatorhub.config")

DEV_JWT_SECRET = "dev-only-secret-change-me-0123456789abcdef"  # never used in production
DEFAULT_SQLITE_URL = "sqlite:///./creatorhub.db"
VALID_ENVS = ("development", "demo", "production")


class ConfigurationError(RuntimeError):
    """Raised at startup when the production configuration is unsafe."""


def _split_csv(value: str | list[str] | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [v.strip() for v in value if v and v.strip()]
    return [v.strip() for v in str(value).split(",") if v.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    app_env: str = "development"
    debug: bool = False
    database_url: Optional[str] = None

    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None

    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4.1-mini"
    youtube_api_key: Optional[str] = None

    jwt_secret: Optional[str] = None
    jwt_expire_minutes: int = 60
    jwt_remember_expire_minutes: int = 43200

    frontend_url: str = "http://localhost:5173"
    cors_origins_raw: Optional[str] = Field(default=None, validation_alias="CORS_ORIGINS")

    auto_seed_raw: Optional[str] = Field(default=None, validation_alias="AUTO_SEED")

    ai_rate_limit_per_minute: int = 20
    ai_daily_limit_per_user: int = 200
    log_level: str = "INFO"

    @field_validator("app_env", mode="before")
    @classmethod
    def _norm_env(cls, v):
        v = (str(v or "development")).strip().lower()
        return v if v in VALID_ENVS else "development"

    @field_validator(
        "database_url", "supabase_url", "supabase_key", "supabase_service_role_key",
        "openai_api_key", "youtube_api_key", "jwt_secret", "cors_origins_raw", "auto_seed_raw",
        mode="before",
    )
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    # ---- derived values -------------------------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_demo(self) -> bool:
        return self.app_env == "demo"

    @property
    def openai_enabled(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def youtube_enabled(self) -> bool:
        return bool(self.youtube_api_key)

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and (self.supabase_key or self.supabase_service_role_key))

    @property
    def effective_database_url(self) -> str:
        return self.database_url or DEFAULT_SQLITE_URL

    @property
    def effective_jwt_secret(self) -> str:
        return self.jwt_secret or DEV_JWT_SECRET

    @property
    def cors_origins(self) -> list[str]:
        origins = _split_csv(self.cors_origins_raw)
        if not origins:
            origins = [self.frontend_url] if self.frontend_url else []
            if not self.is_production:
                origins = list(dict.fromkeys(origins + ["http://localhost:5173", "http://127.0.0.1:5173"]))
        return origins

    @property
    def auto_seed(self) -> bool:
        raw = self.auto_seed_raw
        if raw is None:
            return not self.is_production
        return str(raw).strip().lower() in ("1", "true", "yes", "on")

    # ---- validation -----------------------------------------------------------------------
    def production_problems(self) -> list[str]:
        """Technical reasons (server-side log only) why this config is unsafe for production."""
        problems: list[str] = []
        if not self.jwt_secret:
            problems.append("JWT_SECRET is not set")
        elif len(self.jwt_secret) < 32 or self.jwt_secret == DEV_JWT_SECRET:
            problems.append("JWT_SECRET is too short (min 32 chars) or is the development default")
        if not self.database_url:
            problems.append("DATABASE_URL is not set")
        if "*" in _split_csv(self.cors_origins_raw) or self.frontend_url.strip() == "*":
            problems.append("CORS must not allow '*' in production")
        if self.debug:
            problems.append("DEBUG must be disabled in production")
        return problems

    def validate_startup(self) -> None:
        """Log integration status; in production refuse to start on unsafe configuration."""
        if not self.openai_enabled:
            logger.warning("OPENAI_API_KEY not set: AI features run in sample mode.")
        if not self.youtube_enabled:
            logger.warning("YOUTUBE_API_KEY not set: trend refresh and competitor analysis use sample data.")
        if not self.supabase_enabled:
            logger.info("Supabase integration not configured (optional).")
        if self.is_production:
            problems = self.production_problems()
            if problems:
                for p in problems:
                    logger.error("Unsafe production configuration: %s", p)
                raise ConfigurationError("Unsafe production configuration; see server log.")
        elif not self.jwt_secret:
            logger.warning("JWT_SECRET not set: using a development-only secret (not for production).")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    """Test helper: drop the cached Settings so changed env vars are re-read."""
    get_settings.cache_clear()


def configure_logging(level: str | None = None) -> None:
    lvl = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    logging.basicConfig(level=getattr(logging, lvl, logging.INFO),
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
