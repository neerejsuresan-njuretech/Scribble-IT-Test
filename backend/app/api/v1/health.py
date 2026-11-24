from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.redis import redis_manager
from app.db.session import db_manager

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str


class DependencyCheck(BaseModel):
    status: str
    latency_ms: float | None = None
    detail: str | None = None
    role_verified_non_superuser: bool | None = None


class ReadinessResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    checks: dict[str, DependencyCheck]


class VersionResponse(BaseModel):
    service: str
    version: str
    api_version: str
    environment: str


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
    description="Lightweight process liveness probe verifying the FastAPI runtime is responsive.",
)
async def liveness(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": ReadinessResponse, "description": "One or more backing services unavailable"}},
    summary="Readiness probe",
    description="Verifies live PostgreSQL and Redis connectivity and returns HTTP 503 if degraded.",
)
async def readiness(settings: Settings = Depends(get_settings)) -> JSONResponse:
    db_status: dict[str, Any] = await db_manager.check_health()
    redis_status: dict[str, Any] = await redis_manager.check_health()

    all_healthy = db_status.get("status") == "ok" and redis_status.get("status") == "ok"
    payload = ReadinessResponse(
        status="ready" if all_healthy else "degraded",
        service=settings.app_name,
        timestamp=datetime.now(timezone.utc).isoformat(),
        checks={
            "database": DependencyCheck(**db_status),
            "redis": DependencyCheck(**redis_status),
        },
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        content=payload.model_dump(exclude_none=True),
    )


@router.get(
    "/version",
    response_model=VersionResponse,
    summary="Platform build version",
)
async def version(settings: Settings = Depends(get_settings)) -> VersionResponse:
    return VersionResponse(
        service=settings.app_name,
        version=settings.app_version,
        api_version="v1",
        environment=settings.app_env,
    )
