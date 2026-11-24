from __future__ import annotations

import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import Settings
from app.core.exceptions import build_error_response
from app.core.logging import request_id_ctx, tenant_id_ctx

logger = logging.getLogger("scribble_it.http")


class RequestContextAndSecurityMiddleware(BaseHTTPMiddleware):
    """
    Centralized HTTP middleware:
    - Generates or propagates sanitized X-Request-ID correlation header.
    - Enforces maximum request payload size before body processing.
    - Emits structured access logs with timing.
    - Attaches strict security headers to every HTTP response.
    """

    def __init__(self, app, *, settings: Settings) -> None:
        super().__init__(app)
        self._settings = settings

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        incoming_req_id = request.headers.get("X-Request-ID", "").strip()
        if incoming_req_id and len(incoming_req_id) <= 64 and incoming_req_id.replace("-", "").isalnum():
            req_id = incoming_req_id
        else:
            req_id = str(uuid.uuid4())

        req_token = request_id_ctx.set(req_id)
        tenant_token = tenant_id_ctx.set("-")
        started = time.perf_counter()

        try:
            content_length = request.headers.get("content-length")
            if content_length is not None:
                try:
                    if int(content_length) > self._settings.max_request_body_bytes:
                        response = build_error_response(
                            status_code=413,
                            error_code="PAYLOAD_TOO_LARGE",
                            message=(
                                f"Request body exceeds maximum allowed size of "
                                f"{self._settings.max_request_body_bytes} bytes."
                            ),
                        )
                        self._apply_security_headers(response, request.url.path, req_id)
                        return response
                except ValueError:
                    pass

            response = await call_next(request)
            self._apply_security_headers(response, request.url.path, req_id)

            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.info(
                "HTTP request completed",
                extra={
                    "extra_fields": {
                        "method": request.method,
                        "path": request.url.path,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                    }
                },
            )
            return response
        finally:
            request_id_ctx.reset(req_token)
            tenant_id_ctx.reset(tenant_token)

    def _apply_security_headers(self, response: Response, path: str, req_id: str) -> None:
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        if self._settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
