from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import request_id_ctx
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.audit import AuditLog
from app.db.session import enable_transaction_platform_lookup

_REDACTED_KEYS = frozenset(
    {
        "password",
        "password_hash",
        "refresh_token",
        "access_token",
        "secret",
        "totp_secret",
        "backup_codes",
        "enrollment_code",
        "token",
    }
)


def _sanitize_metadata(data: dict[str, Any] | None) -> dict[str, Any]:
    if not data:
        return {}
    sanitized: dict[str, Any] = {}
    for key, value in data.items():
        if key.lower() in _REDACTED_KEYS:
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = _sanitize_metadata(value)
        else:
            sanitized[key] = value
    return sanitized


def extract_client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client and request.client.host:
        return str(request.client.host)[:64]
    return None


def extract_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    ua = request.headers.get("User-Agent")
    return ua[:512] if ua else None


class AuditService:
    """Append-only centralized security, IAM, tenant, and governance audit recorder."""

    @staticmethod
    async def record(
        db: AsyncSession,
        *,
        action: str,
        module: str,
        actor_email: str = "anonymous",
        actor_user_id: uuid.UUID | None = None,
        organization_id: uuid.UUID | None = None,
        portal_type: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        outcome: str = "success",
        detail: str = "",
        metadata: dict[str, Any] | None = None,
        request: Request | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_email=actor_email[:160],
            portal_type=portal_type,
            module=module[:64],
            action=action[:64],
            target_type=target_type[:64] if target_type else None,
            target_id=str(target_id)[:128] if target_id is not None else None,
            outcome=outcome[:24],
            ip_address=extract_client_ip(request),
            user_agent=extract_user_agent(request),
            request_id=request_id_ctx.get(),
            detail=detail,
            metadata_json=_sanitize_metadata(metadata),
        )
        db.add(entry)
        await db.flush()
        # Security denials and failures are immediately followed by raising a domain exception
        # (401/403/422), which causes the request session dependency to roll back uncommitted work.
        # Commit here so immutable denial audit events and defensive state mutations (e.g., refresh
        # token family revocation, failed-login lockouts, expired enrollment codes) always persist.
        if outcome in {"denied", "failure", "blocked"}:
            await db.commit()
        return entry

    @staticmethod
    async def list_logs(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        organization_id: uuid.UUID | None = None,
        module: str | None = None,
        action: str | None = None,
        outcome: str | None = None,
        actor_email: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        conditions = []

        if principal.is_super_admin:
            # Super Admin may query across organizations or filter to a specific organization
            await enable_transaction_platform_lookup(db)
            if organization_id is not None:
                conditions.append(AuditLog.organization_id == organization_id)
        else:
            # Strictly scoped to the authenticated principal's verified organization
            conditions.append(AuditLog.organization_id == principal.organization_id)

        if module:
            conditions.append(AuditLog.module == module.strip())
        if action:
            conditions.append(AuditLog.action == action.strip())
        if outcome:
            conditions.append(AuditLog.outcome == outcome.strip())
        if actor_email:
            conditions.append(AuditLog.actor_email.ilike(f"%{actor_email.strip()}%"))

        count_stmt = select(func.count(AuditLog.id)).where(*conditions)
        total = int((await db.execute(count_stmt)).scalar_one())

        rows_stmt = (
            select(AuditLog)
            .where(*conditions)
            .order_by(desc(AuditLog.created_at))
            .limit(limit)
            .offset(offset)
        )
        items = list((await db.execute(rows_stmt)).scalars().all())
        return items, total
