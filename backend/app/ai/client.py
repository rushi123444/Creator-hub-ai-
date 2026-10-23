"""Thin wrapper over the OpenAI Responses API (`client.responses.create`).

- Structured output via `text={"format": {"type": "json_schema", "strict": True, ...}}`.
- 30 s timeout; ONE retry on 429 / 5xx / timeout / connection errors (the SDK's own retries are disabled
  so the policy is exactly "one retry").
- Every failure mode (API error, timeout, rate limit, empty output, invalid JSON) ends in
  `AIUnavailableError` with the friendly message. Provider error text is logged by type only and
  never returned to callers.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Optional

from app.ai.schemas import InvalidModelOutput
from app.config.settings import get_settings
from app.errors import AIUnavailableError

logger = logging.getLogger("creatorhub.ai")

TIMEOUT_SECONDS = 30.0
MAX_OUTPUT_TOKENS = 3500
RETRY_DELAY_SECONDS = 0.6


@dataclass
class ClientResult:
    data: dict
    model: str
    output_chars: int


def _build_client(api_key: str):
    import openai

    return openai.OpenAI(api_key=api_key, timeout=TIMEOUT_SECONDS, max_retries=0)


def get_client():
    """Seam for tests: monkeypatch `app.ai.client.get_client` to return a fake."""
    key = get_settings().openai_api_key
    if not key:
        raise AIUnavailableError()
    return _build_client(key)


def _retryable(exc: Exception) -> bool:
    try:
        import openai
    except ImportError:  # pragma: no cover
        return False
    if isinstance(exc, (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError)):
        return True
    if isinstance(exc, openai.APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    return isinstance(exc, TimeoutError)


def _extract_text(response: Any) -> str:
    text = getattr(response, "output_text", None)
    if isinstance(text, str) and text.strip():
        return text
    # Fallback: walk output items for message text parts.
    parts: list[str] = []
    for item in getattr(response, "output", None) or []:
        for part in getattr(item, "content", None) or []:
            value = getattr(part, "text", None)
            if isinstance(value, str):
                parts.append(value)
    return "".join(parts)


def _decode(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):] if "{" in text else text
    if not text:
        raise InvalidModelOutput("empty output")
    try:
        data = json.loads(text)
    except ValueError as exc:
        raise InvalidModelOutput("output is not valid JSON") from exc
    if not isinstance(data, dict) or not data:
        raise InvalidModelOutput("output is not a JSON object")
    return data


def generate_json(
    *,
    system: str,
    user: str,
    schema: dict,
    schema_name: str,
    model: Optional[str] = None,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
) -> ClientResult:
    """Call the Responses API and return decoded JSON. Raises AIUnavailableError on any failure."""
    settings = get_settings()
    model_name = model or settings.openai_model
    client = get_client()
    kwargs: dict[str, Any] = dict(
        model=model_name,
        instructions=system,
        input=user,
        max_output_tokens=max_output_tokens,
        store=False,
        text={"format": {"type": "json_schema", "name": schema_name[:60], "schema": schema, "strict": True}},
        timeout=TIMEOUT_SECONDS,
    )
    last_kind = "unknown"
    for attempt in (1, 2):
        try:
            response = client.responses.create(**kwargs)
            raw = _extract_text(response)
            data = _decode(raw)
            return ClientResult(data=data, model=model_name, output_chars=len(raw))
        except InvalidModelOutput as exc:
            last_kind = "invalid_output"
            logger.warning("AI output rejected (attempt %s): %s", attempt, exc)
            break  # a malformed answer is not retried: same prompt, same schema
        except AIUnavailableError:
            raise
        except Exception as exc:  # noqa: BLE001 - provider errors are never surfaced
            last_kind = type(exc).__name__
            if attempt == 1 and _retryable(exc):
                logger.warning("AI call failed (%s); retrying once", last_kind)
                time.sleep(RETRY_DELAY_SECONDS)
                continue
            logger.error("AI call failed (%s) on attempt %s", last_kind, attempt)
            break
    logger.error("AI generation unavailable (%s)", last_kind)
    raise AIUnavailableError()
