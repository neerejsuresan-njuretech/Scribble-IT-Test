from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.redis import redis_manager
from app.db.session import db_manager

router = APIRouter()
_PROCESS_STARTED_AT = time.time()


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


class ClientAuthCapabilitiesOut(BaseModel):
    access_token_ttl_minutes: int
    refresh_token_ttl_days: int
    refresh_token_rotation: bool = True
    mfa_totp_supported: bool = True
    device_sso_supported: bool = True


class ClientFeatureFlagsOut(BaseModel):
    push_notifications_enabled: bool
    fcm_configured: bool
    apns_configured: bool
    device_trust_enabled: bool = True
    ai_enabled: bool


class ClientConfigResponse(BaseModel):
    service: str
    instance_name: str
    deployment_mode: str
    public_api_url: str | None
    api_version: str
    api_prefix: str
    supported_client_types: list[str]
    supported_client_platforms: list[str]
    minimum_client_versions: dict[str, str]
    allowed_native_app_ids: list[str]
    auth: ClientAuthCapabilitiesOut
    features: ClientFeatureFlagsOut


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


@router.get(
    "/client/config",
    response_model=ClientConfigResponse,
    summary="Native & web client bootstrap configuration",
    description=(
        "Non-sensitive server discovery endpoint for desktop, mobile, and self-hosted clients "
        "advertising API versioning, deployment mode, minimum versions, and capabilities."
    ),
)
async def client_config(settings: Settings = Depends(get_settings)) -> ClientConfigResponse:
    fcm_ready = bool(
        settings.fcm_project_id.strip()
        and settings.fcm_client_email.strip()
        and settings.fcm_private_key.get_secret_value().strip()
    )
    apns_ready = bool(
        settings.apns_team_id.strip()
        and settings.apns_key_id.strip()
        and settings.apns_bundle_id.strip()
        and settings.apns_private_key.get_secret_value().strip()
    )
    return ClientConfigResponse(
        service=settings.app_name,
        instance_name=settings.instance_name,
        deployment_mode=settings.deployment_mode,
        public_api_url=settings.public_api_url,
        api_version="v1",
        api_prefix=settings.api_v1_prefix,
        supported_client_types=["web", "desktop", "mobile"],
        supported_client_platforms=["web", "windows", "macos", "linux", "android", "ios"],
        minimum_client_versions={
            "desktop": settings.min_desktop_app_version,
            "mobile": settings.min_mobile_app_version,
        },
        allowed_native_app_ids=list(settings.allowed_native_app_ids),
        auth=ClientAuthCapabilitiesOut(
            access_token_ttl_minutes=settings.access_token_ttl_minutes,
            refresh_token_ttl_days=settings.refresh_token_ttl_days,
        ),
        features=ClientFeatureFlagsOut(
            push_notifications_enabled=True,
            fcm_configured=fcm_ready,
            apns_configured=apns_ready,
            device_trust_enabled=True,
            ai_enabled=bool(settings.gemini_api_key.get_secret_value().strip()),
        ),
    )


@router.get(
    "/metrics",
    response_class=PlainTextResponse,
    summary="Prometheus observability metrics",
    description="Exports Prometheus-compatible process, database pool, Redis, and worker heartbeat metrics.",
)
async def metrics(settings: Settings = Depends(get_settings)) -> PlainTextResponse:
    uptime_seconds = max(0.0, time.time() - _PROCESS_STARTED_AT)
    db_status = await db_manager.check_health()
    redis_status = await redis_manager.check_health()

    db_up = 1 if db_status.get("status") == "ok" else 0
    redis_up = 1 if redis_status.get("status") == "ok" else 0
    db_latency_ms = float(db_status.get("latency_ms") or 0.0)
    redis_latency_ms = float(redis_status.get("latency_ms") or 0.0)

    pool_size = 0
    pool_checked_out = 0
    try:
        pool = db_manager.engine.sync_engine.pool
        pool_size = int(getattr(pool, "size", lambda: 0)())
        pool_checked_out = int(getattr(pool, "checkedout", lambda: 0)())
    except Exception:
        pass

    worker_heartbeat_age = -1.0
    try:
        client = getattr(redis_manager, "client", None)
        if client is not None:
            raw_hb = await client.get("scribble:worker:heartbeat")
            if raw_hb:
                worker_heartbeat_age = max(0.0, time.time() - float(raw_hb))
    except Exception:
        worker_heartbeat_age = -1.0

    lines = [
        "# HELP scribble_process_uptime_seconds Seconds since FastAPI process started.",
        "# TYPE scribble_process_uptime_seconds gauge",
        f'scribble_process_uptime_seconds{{env="{settings.app_env}",version="{settings.app_version}"}} {uptime_seconds:.2f}',
        "# HELP scribble_dependency_up Backing service availability (1=up, 0=down).",
        "# TYPE scribble_dependency_up gauge",
        f'scribble_dependency_up{{dependency="postgres"}} {db_up}',
        f'scribble_dependency_up{{dependency="redis"}} {redis_up}',
        "# HELP scribble_dependency_latency_ms Backing service health check latency in milliseconds.",
        "# TYPE scribble_dependency_latency_ms gauge",
        f'scribble_dependency_latency_ms{{dependency="postgres"}} {db_latency_ms:.2f}',
        f'scribble_dependency_latency_ms{{dependency="redis"}} {redis_latency_ms:.2f}',
        "# HELP scribble_db_pool_connections SQLAlchemy connection pool utilization.",
        "# TYPE scribble_db_pool_connections gauge",
        f'scribble_db_pool_connections{{state="size"}} {pool_size}',
        f'scribble_db_pool_connections{{state="checked_out"}} {pool_checked_out}',
        "# HELP scribble_worker_heartbeat_age_seconds Seconds since last background worker heartbeat (-1 if unavailable).",
        "# TYPE scribble_worker_heartbeat_age_seconds gauge",
        f"scribble_worker_heartbeat_age_seconds {worker_heartbeat_age:.2f}",
    ]
    return PlainTextResponse(
        content="\n".join(lines) + "\n",
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )
