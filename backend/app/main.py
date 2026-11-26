from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_v1_router
from app.core.config import Settings, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextAndSecurityMiddleware
from app.core.redis import redis_manager
from app.db.session import db_manager

logger = logging.getLogger("scribble_it.app")


def create_app(settings_override: Settings | None = None) -> FastAPI:
    """Construct and configure the Scribble-IT 2.0 FastAPI application."""
    settings = settings_override or get_settings()
    configure_logging(settings)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        logger.info(
            "Starting Scribble-IT 2.0 backend",
            extra={
                "extra_fields": {
                    "version": settings.app_version,
                    "environment": settings.app_env,
                }
            },
        )
        db_manager.init(settings)
        redis_manager.init(settings)
        try:
            yield
        finally:
            await redis_manager.close()
            await db_manager.close()
            logger.info("Scribble-IT 2.0 backend shutdown complete")

    docs_url = "/api/docs" if settings.enable_openapi_docs else None
    redoc_url = "/api/redoc" if settings.enable_openapi_docs else None
    openapi_url = "/api/openapi.json" if settings.enable_openapi_docs else None

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Enterprise multi-tenant IT Service Management (ITSM) platform API. "
            "Built on FastAPI, PostgreSQL with Row-Level Security, SQLAlchemy 2.x, and Redis."
        ),
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )

    if settings_override is not None:
        application.dependency_overrides[get_settings] = lambda: settings_override

    # Strict CORS allowlist (never wildcard with credentials)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.effective_cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Request-ID",
            "X-Organization-ID",
            "X-Scribble-Client-Type",
            "X-Scribble-Client-Platform",
            "X-Scribble-App-Version",
            "X-Scribble-App-Id",
            "X-Scribble-Device-Name",
        ],
        expose_headers=[
            "X-Request-ID",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-Scribble-API-Version",
        ],
    )

    application.add_middleware(RequestContextAndSecurityMiddleware, settings=settings)
    register_exception_handlers(application)

    application.include_router(api_v1_router, prefix=settings.api_v1_prefix)

    return application


app = create_app()
