from __future__ import annotations

import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.client_meta import resolve_client_metadata
from app.core.config import Settings
from app.core.exceptions import AppError, build_error_response
from app.core.logging import request_id_ctx, tenant_id_ctx
from app.core.rate_limit import rate_limiter
from app.core.redis import redis_manager

logger = logging.getLogger("scribble_it.http")

STATE_CHANGING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class RequestContextAndSecurityMiddleware(BaseHTTPMiddleware):
    """
    Centralized HTTP security & telemetry middleware:
    - Generates or propagates sanitized X-Request-ID correlation header.
    - Enforces maximum request payload size before body processing.
    - Enforces sliding-window per-client IP rate limiting on /api/* endpoints.
    - Enforces Origin/Referer CSRF verification when cookies accompany state-changing calls.
    - Emits structured access logs with timing.
    - Attaches strict security headers (including CSP & HSTS) to every HTTP response.
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
            # 1. Payload size guard
            content_length = request.headers.get("content-length")
            max_bytes = (
                self._settings.max_upload_bytes
                if request.url.path.endswith("/attachments")
                else self._settings.max_request_body_bytes
            )
            if content_length is not None:
                try:
                    if int(content_length) > max_bytes:
                        response = build_error_response(
                            status_code=413,
                            error_code="PAYLOAD_TOO_LARGE",
                            message=f"Request body exceeds maximum allowed size of {max_bytes} bytes.",
                        )
                        self._apply_security_headers(response, request.url.path, req_id)
                        return response
                except ValueError:
                    pass

            # 2. CSRF protection for any cookie-bearing state-changing API request
            if (
                request.url.path.startswith("/api/")
                and request.method in STATE_CHANGING_METHODS
                and request.headers.get("cookie")
                and not request.headers.get("authorization")
            ):
                origin = request.headers.get("origin", "").strip()
                allowed = set(self._settings.effective_cors_allowed_origins)
                if not origin or origin not in allowed:
                    response = build_error_response(
                        status_code=403,
                        error_code="CSRF_ORIGIN_MISMATCH",
                        message="Cross-site state-changing request rejected by origin policy.",
                    )
                    self._apply_security_headers(response, request.url.path, req_id)
                    return response

            # 2b. Validate declared native client application metadata headers when present
            if request.url.path.startswith("/api/") and any(
                request.headers.get(h, "").strip()
                for h in (
                    "X-Scribble-Client-Type",
                    "X-Scribble-Client-Platform",
                    "X-Scribble-App-Version",
                    "X-Scribble-App-Id",
                )
            ):
                try:
                    resolve_client_metadata(request=request, settings=self._settings)
                except AppError as exc:
                    response = build_error_response(
                        status_code=exc.status_code,
                        error_code=exc.error_code,
                        message=exc.message,
                        details=exc.details,
                    )
                    self._apply_security_headers(response, request.url.path, req_id)
                    return response

            # 3. Sliding-window rate limiting on API endpoints (exempt health probes)
            rate_headers: dict[str, str] = {}
            if (
                request.url.path.startswith("/api/")
                and not request.url.path.startswith("/api/v1/health")
                and self._settings.app_env != "test"
            ):
                client_ip = (
                    request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                    or (request.client.host if request.client else "unknown")
                )
                redis_client = getattr(redis_manager, "client", None)
                rl = await rate_limiter.check(
                    f"rl:ip:{client_ip}",
                    limit=self._settings.api_rate_limit_per_minute,
                    window_seconds=60,
                    redis_client=redis_client,
                )
                rate_headers = {
                    "X-RateLimit-Limit": str(rl.limit),
                    "X-RateLimit-Remaining": str(rl.remaining),
                    "X-RateLimit-Reset": str(rl.reset_after_seconds),
                }
                if not rl.allowed:
                    response = build_error_response(
                        status_code=429,
                        error_code="RATE_LIMITED",
                        message="Too many requests. Please slow down and retry shortly.",
                    )
                    for k, v in rate_headers.items():
                        response.headers[k] = v
                    response.headers["Retry-After"] = str(rl.reset_after_seconds)
                    self._apply_security_headers(response, request.url.path, req_id)
                    return response

            response = await call_next(request)
            for k, v in rate_headers.items():
                response.headers[k] = v
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
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        if path.startswith("/api/"):
            response.headers["X-Scribble-API-Version"] = "v1"
            response.headers.setdefault("Cache-Control", "no-store")
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if self._settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
