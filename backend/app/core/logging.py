from __future__ import annotations

import contextvars
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import Settings

request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
tenant_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("tenant_id", default="-")

REDACTED_KEYS = frozenset(
    {
        "password",
        "passwd",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "api_key",
        "apikey",
        "cookie",
        "set-cookie",
    }
)


def _redact_sensitive(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for k, v in value.items():
            if str(k).lower() in REDACTED_KEYS:
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = _redact_sensitive(v)
        return sanitized
    if isinstance(value, list):
        return [_redact_sensitive(item) for item in value]
    return value


class StructuredJsonFormatter(logging.Formatter):
    """Formats application logs as single-line JSON with correlation metadata."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx.get(),
            "organization_id": tenant_id_ctx.get(),
        }

        extra_fields = getattr(record, "extra_fields", None)
        if isinstance(extra_fields, dict):
            payload.update(_redact_sensitive(extra_fields))

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    """Readable development formatter including request correlation ID."""

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        req_id = request_id_ctx.get()
        base = f"{ts} [{record.levelname}] [req:{req_id}] {record.name}: {record.getMessage()}"
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def configure_logging(settings: Settings) -> None:
    """Configure root, FastAPI, SQLAlchemy, and Uvicorn loggers."""
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.log_level, logging.INFO))
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter() if settings.log_json else ConsoleFormatter())
    root_logger.addHandler(handler)

    # Align third-party loggers to prevent duplicate noisy output
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi", "sqlalchemy.engine"):
        ext_logger = logging.getLogger(logger_name)
        ext_logger.handlers.clear()
        ext_logger.propagate = True
        if logger_name == "sqlalchemy.engine" and not settings.db_echo_sql:
            ext_logger.setLevel(logging.WARNING)
