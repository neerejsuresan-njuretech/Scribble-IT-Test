from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.crypto import (
    decrypt_json_payload,
    decrypt_secret,
    encrypt_json_payload,
    encrypt_secret,
)
from app.core.exceptions import AuthorizationError, NotFoundError, ValidationDomainError
from app.core.ssrf import SsrfBlockedError, validate_outbound_url
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.integrations import (
    BackgroundJob,
    IntegrationConnection,
    TelephonyCallLog,
    WebhookEndpoint,
)
from app.db.models.organizations import Organization
from app.db.session import set_transaction_tenant_context
from app.modules.audit.service import AuditService
from app.modules.integrations.adapters import (
    GoogleWorkspaceAdapter,
    TwilioTelephonyAdapter,
)
from app.modules.integrations.schemas import (
    BackgroundJobOut,
    GoogleWorkspaceActionRequest,
    IntegrationConnectionOut,
    IntegrationCreateRequest,
    IntegrationUpdateRequest,
    NotificationDispatchRequest,
    OAuthTokenUpdateRequest,
    OutboundCallRequest,
    TelephonyCallOut,
    WebhookCreateRequest,
    WebhookEndpointOut,
)


def _to_connection_out(conn: IntegrationConnection) -> IntegrationConnectionOut:
    return IntegrationConnectionOut(
        id=conn.id,
        organization_id=conn.organization_id,
        provider=conn.provider,
        display_name=conn.display_name,
        status=conn.status,
        config_json=conn.config_json or {},
        has_credentials=bool(conn.encrypted_credentials),
        has_oauth_token=bool(conn.encrypted_oauth_access_token),
        oauth_token_expires_at=conn.oauth_token_expires_at,
        oauth_scopes=conn.oauth_scopes or [],
        allowed_roles=conn.allowed_roles or [],
        last_synced_at=conn.last_synced_at,
        last_error=conn.last_error,
        created_at=conn.created_at,
        updated_at=conn.updated_at,
    )


def _to_webhook_out(wh: WebhookEndpoint) -> WebhookEndpointOut:
    return WebhookEndpointOut(
        id=wh.id,
        organization_id=wh.organization_id,
        name=wh.name,
        target_url=wh.target_url,
        subscribed_events=wh.subscribed_events or [],
        is_active=wh.is_active,
        max_retries=wh.max_retries,
        last_delivery_status=wh.last_delivery_status,
        last_delivered_at=wh.last_delivered_at,
        created_at=wh.created_at,
    )


def _to_call_out(call: TelephonyCallLog) -> TelephonyCallOut:
    return TelephonyCallOut(
        id=call.id,
        organization_id=call.organization_id,
        provider=call.provider,
        provider_call_sid=call.provider_call_sid,
        direction=call.direction,
        status=call.status,
        from_number=call.from_number,
        to_number=call.to_number,
        caller_name=call.caller_name,
        linked_incident_id=call.linked_incident_id,
        duration_seconds=call.duration_seconds,
        notes=call.notes,
        created_at=call.created_at,
    )


def _to_job_out(job: BackgroundJob) -> BackgroundJobOut:
    return BackgroundJobOut(
        id=job.id,
        organization_id=job.organization_id,
        job_type=job.job_type,
        status=job.status,
        attempts=job.attempts,
        max_attempts=job.max_attempts,
        next_run_at=job.next_run_at,
        last_error=job.last_error,
        completed_at=job.completed_at,
        created_at=job.created_at,
    )


class IntegrationsService:
    """Tenant-scoped service for encrypted integrations, OAuth lifecycle, webhooks, telephony, and jobs."""

    @staticmethod
    async def list_connections(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> list[IntegrationConnectionOut]:
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        rows = (
            await db.execute(
                select(IntegrationConnection)
                .where(IntegrationConnection.organization_id == principal.organization_id)
                .order_by(IntegrationConnection.created_at.desc())
            )
        ).scalars().all()
        return [_to_connection_out(r) for r in rows]

    @staticmethod
    async def create_connection(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: IntegrationCreateRequest,
        request: Request | None = None,
    ) -> IntegrationConnectionOut:
        settings = get_settings()
        master_key = settings.integration_encryption_key.get_secret_value()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)

        enc_creds = (
            encrypt_json_payload(payload.credentials, master_key)
            if payload.credentials
            else None
        )
        conn = IntegrationConnection(
            organization_id=principal.organization_id,
            provider=payload.provider,
            display_name=payload.display_name,
            status="active",
            config_json=payload.config_json,
            encrypted_credentials=enc_creds,
            oauth_scopes=payload.oauth_scopes,
            allowed_roles=payload.allowed_roles,
            created_by_user_id=principal.user_id,
        )
        db.add(conn)
        await db.flush()

        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="integrations",
            action="integration.created",
            entity_type="integration_connection",
            entity_id=str(conn.id),
            summary=f"Created encrypted integration connection '{conn.display_name}' ({conn.provider})",
            request=request,
        )
        await db.commit()
        await db.refresh(conn)
        return _to_connection_out(conn)

    @staticmethod
    async def update_connection(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        connection_id: uuid.UUID,
        payload: IntegrationUpdateRequest,
        request: Request | None = None,
    ) -> IntegrationConnectionOut:
        settings = get_settings()
        master_key = settings.integration_encryption_key.get_secret_value()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)

        conn = (
            await db.execute(
                select(IntegrationConnection).where(
                    IntegrationConnection.id == connection_id,
                    IntegrationConnection.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not conn:
            raise NotFoundError("Integration connection not found.")

        if payload.display_name is not None:
            conn.display_name = payload.display_name
        if payload.status is not None:
            conn.status = payload.status
        if payload.config_json is not None:
            conn.config_json = payload.config_json
        if payload.allowed_roles is not None:
            conn.allowed_roles = payload.allowed_roles
        if payload.credentials is not None:
            conn.encrypted_credentials = encrypt_json_payload(payload.credentials, master_key)

        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="integrations",
            action="integration.updated",
            entity_type="integration_connection",
            entity_id=str(conn.id),
            summary=f"Updated integration '{conn.display_name}' (status={conn.status})",
            request=request,
        )
        await db.commit()
        await db.refresh(conn)
        return _to_connection_out(conn)

    @staticmethod
    async def store_oauth_tokens(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        connection_id: uuid.UUID,
        payload: OAuthTokenUpdateRequest,
        request: Request | None = None,
    ) -> IntegrationConnectionOut:
        settings = get_settings()
        master_key = settings.integration_encryption_key.get_secret_value()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)

        conn = (
            await db.execute(
                select(IntegrationConnection).where(
                    IntegrationConnection.id == connection_id,
                    IntegrationConnection.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not conn:
            raise NotFoundError("Integration connection not found.")

        conn.encrypted_oauth_access_token = encrypt_secret(payload.access_token, master_key)
        if payload.refresh_token:
            conn.encrypted_oauth_refresh_token = encrypt_secret(payload.refresh_token, master_key)
        conn.oauth_token_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=payload.expires_in_seconds
        )
        if payload.scopes:
            conn.oauth_scopes = payload.scopes
        conn.status = "active"
        conn.last_synced_at = datetime.now(timezone.utc)
        conn.last_error = None

        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="integrations",
            action="integration.oauth_tokens_updated",
            entity_type="integration_connection",
            entity_id=str(conn.id),
            summary=f"Stored encrypted OAuth token bundle for '{conn.display_name}' ({conn.provider})",
            request=request,
        )
        await db.commit()
        await db.refresh(conn)
        return _to_connection_out(conn)

    @staticmethod
    async def execute_google_workspace_action(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: GoogleWorkspaceActionRequest,
        request: Request | None = None,
    ) -> dict[str, Any]:
        settings = get_settings()
        master_key = settings.integration_encryption_key.get_secret_value()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)

        conn = (
            await db.execute(
                select(IntegrationConnection).where(
                    IntegrationConnection.id == payload.connection_id,
                    IntegrationConnection.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not conn or not conn.provider.startswith("google_"):
            raise NotFoundError("Google Workspace integration connection not found.")
        if conn.status != "active":
            raise AuthorizationError("Google Workspace integration is not active.")
        if not conn.encrypted_oauth_access_token:
            raise ValidationDomainError("Google Workspace OAuth token is not connected yet.")

        access_token = decrypt_secret(conn.encrypted_oauth_access_token, master_key)

        # Auto-refresh token if expired and refresh token + OAuth client credentials exist
        now = datetime.now(timezone.utc)
        if (
            conn.oauth_token_expires_at is not None
            and conn.oauth_token_expires_at <= now + timedelta(seconds=60)
            and conn.encrypted_oauth_refresh_token
            and conn.encrypted_credentials
        ):
            creds = decrypt_json_payload(conn.encrypted_credentials, master_key)
            refresh_token = decrypt_secret(conn.encrypted_oauth_refresh_token, master_key)
            new_access, new_expiry = await GoogleWorkspaceAdapter.refresh_access_token(
                client_id=creds.get("client_id", ""),
                client_secret=creds.get("client_secret", ""),
                refresh_token=refresh_token,
            )
            conn.encrypted_oauth_access_token = encrypt_secret(new_access, master_key)
            conn.oauth_token_expires_at = new_expiry
            access_token = new_access

        result = await GoogleWorkspaceAdapter.execute_action(
            access_token=access_token,
            action=payload.action,
            params=payload.params,
        )
        conn.last_synced_at = now
        conn.last_error = None

        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="google_workspace",
            action=f"google.{payload.action}",
            entity_type="integration_connection",
            entity_id=str(conn.id),
            summary=f"Executed Google Workspace action '{payload.action}' via '{conn.display_name}'",
            request=request,
        )
        await db.commit()
        return {"ok": True, "action": payload.action, "data": result}

    # --- Webhooks ---
    @staticmethod
    async def list_webhooks(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> list[WebhookEndpointOut]:
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        rows = (
            await db.execute(
                select(WebhookEndpoint)
                .where(WebhookEndpoint.organization_id == principal.organization_id)
                .order_by(WebhookEndpoint.created_at.desc())
            )
        ).scalars().all()
        return [_to_webhook_out(r) for r in rows]

    @staticmethod
    async def create_webhook(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: WebhookCreateRequest,
        request: Request | None = None,
    ) -> WebhookEndpointOut:
        settings = get_settings()
        try:
            safe_url = validate_outbound_url(
                payload.target_url,
                allow_http_in_test=(settings.app_env == "test"),
            )
        except SsrfBlockedError as exc:
            raise ValidationDomainError(str(exc)) from exc

        master_key = settings.integration_encryption_key.get_secret_value()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)

        wh = WebhookEndpoint(
            organization_id=principal.organization_id,
            name=payload.name,
            target_url=safe_url,
            encrypted_signing_secret=encrypt_secret(payload.signing_secret, master_key),
            subscribed_events=payload.subscribed_events,
            is_active=True,
            max_retries=payload.max_retries,
            created_by_user_id=principal.user_id,
        )
        db.add(wh)
        await db.flush()

        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="webhooks",
            action="webhook.created",
            entity_type="webhook_endpoint",
            entity_id=str(wh.id),
            summary=f"Registered SSRF-validated outbound webhook '{wh.name}'",
            request=request,
        )
        await db.commit()
        await db.refresh(wh)
        return _to_webhook_out(wh)

    @staticmethod
    async def enqueue_webhook_delivery(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        webhook_id: uuid.UUID,
        event_type: str,
        event_payload: dict[str, Any],
    ) -> BackgroundJobOut:
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        wh = (
            await db.execute(
                select(WebhookEndpoint).where(
                    WebhookEndpoint.id == webhook_id,
                    WebhookEndpoint.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if not wh:
            raise NotFoundError("Webhook endpoint not found.")

        job = BackgroundJob(
            organization_id=principal.organization_id,
            job_type="webhook_delivery",
            payload_json={
                "webhook_id": str(wh.id),
                "event_type": event_type,
                "data": event_payload,
            },
            status="queued",
            max_attempts=max(1, wh.max_retries + 1),
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return _to_job_out(job)

    # --- Telephony / Twilio ---
    @staticmethod
    async def list_calls(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> list[TelephonyCallOut]:
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        rows = (
            await db.execute(
                select(TelephonyCallLog)
                .where(TelephonyCallLog.organization_id == principal.organization_id)
                .order_by(TelephonyCallLog.created_at.desc())
                .limit(100)
            )
        ).scalars().all()
        return [_to_call_out(r) for r in rows]

    @staticmethod
    async def place_outbound_call(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: OutboundCallRequest,
        request: Request | None = None,
    ) -> TelephonyCallOut:
        settings = get_settings()
        master_key = settings.integration_encryption_key.get_secret_value()
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)

        # Prefer tenant-specific encrypted Twilio connection; fall back to backend env settings
        conn = (
            await db.execute(
                select(IntegrationConnection).where(
                    IntegrationConnection.organization_id == principal.organization_id,
                    IntegrationConnection.provider == "twilio",
                    IntegrationConnection.status == "active",
                )
            )
        ).scalar_one_or_none()

        account_sid = settings.twilio_account_sid
        auth_token = settings.twilio_auth_token.get_secret_value()
        from_number = settings.twilio_from_number
        if conn and conn.encrypted_credentials:
            creds = decrypt_json_payload(conn.encrypted_credentials, master_key)
            account_sid = creds.get("account_sid", account_sid)
            auth_token = creds.get("auth_token", auth_token)
            from_number = creds.get("from_number", from_number)

        twilio_resp = await TwilioTelephonyAdapter.initiate_outbound_call(
            account_sid=account_sid,
            auth_token=auth_token,
            from_number=from_number,
            to_number=payload.to_number,
        )

        call = TelephonyCallLog(
            organization_id=principal.organization_id,
            provider="twilio",
            provider_call_sid=str(twilio_resp.get("sid", "")) or None,
            direction="outbound",
            status="queued",
            from_number=from_number,
            to_number=payload.to_number,
            caller_name=payload.caller_name,
            agent_user_id=principal.user_id,
            linked_incident_id=payload.linked_incident_id,
            notes=payload.notes,
        )
        db.add(call)
        await db.flush()

        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="telephony",
            action="telephony.outbound_call",
            entity_type="telephony_call",
            entity_id=str(call.id),
            summary=f"Initiated outbound Twilio call to {payload.to_number}",
            request=request,
        )
        await db.commit()
        await db.refresh(call)
        return _to_call_out(call)

    # --- External Notifications & Background Jobs ---
    @staticmethod
    async def enqueue_notification_dispatch(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: NotificationDispatchRequest,
        request: Request | None = None,
    ) -> BackgroundJobOut:
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        conn = (
            await db.execute(
                select(IntegrationConnection).where(
                    IntegrationConnection.id == payload.connection_id,
                    IntegrationConnection.organization_id == principal.organization_id,
                    IntegrationConnection.status == "active",
                )
            )
        ).scalar_one_or_none()
        if not conn:
            raise NotFoundError("Active notification provider connection not found.")

        job = BackgroundJob(
            organization_id=principal.organization_id,
            job_type="external_notification",
            payload_json={
                "connection_id": str(conn.id),
                "provider": conn.provider,
                "channel": payload.channel,
                "subject": payload.subject,
                "message": payload.message,
                "severity": payload.severity,
            },
            status="queued",
            max_attempts=5,
        )
        db.add(job)
        await db.flush()

        await AuditService.log_event(
            db,
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            actor_email=principal.email,
            actor_portal=principal.portal_type,
            module="integrations",
            action="notification.enqueued",
            entity_type="background_job",
            entity_id=str(job.id),
            summary=f"Enqueued external notification via '{conn.display_name}' ({conn.provider})",
            request=request,
        )
        await db.commit()
        await db.refresh(job)
        return _to_job_out(job)

    @staticmethod
    async def list_jobs(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> list[BackgroundJobOut]:
        await set_transaction_tenant_context(db, organization_id=principal.organization_id)
        rows = (
            await db.execute(
                select(BackgroundJob)
                .where(BackgroundJob.organization_id == principal.organization_id)
                .order_by(BackgroundJob.created_at.desc())
                .limit(100)
            )
        ).scalars().all()
        return [_to_job_out(r) for r in rows]

    @staticmethod
    async def resolve_org_by_slug(db: AsyncSession, slug: str) -> Organization | None:
        return (
            await db.execute(select(Organization).where(Organization.slug == slug))
        ).scalar_one_or_none()
