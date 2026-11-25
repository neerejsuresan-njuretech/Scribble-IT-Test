from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.crypto import decrypt_json_payload
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.tenant import AuthenticatedPrincipal, require_permissions
from app.db.models.integrations import IntegrationConnection, TelephonyCallLog
from app.db.session import get_db_session, set_transaction_tenant_context
from app.modules.audit.service import AuditService
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
from app.modules.integrations.service import IntegrationsService
from app.modules.integrations.signatures import (
    verify_inbound_webhook,
    verify_twilio_signature,
)

router = APIRouter(prefix="/integrations", tags=["Integrations & Webhooks"])


@router.get("/connections", response_model=list[IntegrationConnectionOut])
async def list_connections(
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[IntegrationConnectionOut]:
    return await IntegrationsService.list_connections(db, principal=principal)


@router.post("/connections", response_model=IntegrationConnectionOut, status_code=status.HTTP_201_CREATED)
async def create_connection(
    payload: IntegrationCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> IntegrationConnectionOut:
    return await IntegrationsService.create_connection(db, principal=principal, payload=payload, request=request)


@router.patch("/connections/{connection_id}", response_model=IntegrationConnectionOut)
async def update_connection(
    connection_id: uuid.UUID,
    payload: IntegrationUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> IntegrationConnectionOut:
    return await IntegrationsService.update_connection(
        db,
        principal=principal,
        connection_id=connection_id,
        payload=payload,
        request=request,
    )


@router.post("/connections/{connection_id}/oauth-tokens", response_model=IntegrationConnectionOut)
async def update_oauth_tokens(
    connection_id: uuid.UUID,
    payload: OAuthTokenUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> IntegrationConnectionOut:
    return await IntegrationsService.store_oauth_tokens(
        db,
        principal=principal,
        connection_id=connection_id,
        payload=payload,
        request=request,
    )


@router.post("/google/execute")
async def execute_google_workspace(
    payload: GoogleWorkspaceActionRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    return await IntegrationsService.execute_google_workspace_action(
        db,
        principal=principal,
        payload=payload,
        request=request,
    )


@router.get("/webhooks", response_model=list[WebhookEndpointOut])
async def list_webhooks(
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[WebhookEndpointOut]:
    return await IntegrationsService.list_webhooks(db, principal=principal)


@router.post("/webhooks", response_model=WebhookEndpointOut, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    payload: WebhookCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> WebhookEndpointOut:
    return await IntegrationsService.create_webhook(db, principal=principal, payload=payload, request=request)


@router.post("/webhooks/{webhook_id}/test", response_model=BackgroundJobOut, status_code=status.HTTP_202_ACCEPTED)
async def test_webhook(
    webhook_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> BackgroundJobOut:
    return await IntegrationsService.enqueue_webhook_delivery(
        db,
        principal=principal,
        webhook_id=webhook_id,
        event_type="webhook.ping",
        event_payload={"message": "Scribble-IT 2.0 webhook verification ping"},
    )


@router.post("/webhooks/inbound/{org_slug}")
async def receive_signed_inbound_webhook(
    org_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Authenticated HMAC-SHA256 inbound webhook endpoint with replay protection."""
    settings = get_settings()
    body_bytes = await request.body()
    await set_transaction_tenant_context(db, bypass_rls=True)
    org = await IntegrationsService.resolve_org_by_slug(db, org_slug)
    if not org:
        raise NotFoundError("Target organization not found.")

    await set_transaction_tenant_context(db, organization_id=org.id)
    conn = (
        await db.execute(
            select(IntegrationConnection).where(
                IntegrationConnection.organization_id == org.id,
                IntegrationConnection.provider == "webhook_inbound",
                IntegrationConnection.status == "active",
            )
        )
    ).scalar_one_or_none()

    secret = settings.telephony_webhook_secret.get_secret_value()
    if conn and conn.encrypted_credentials:
        creds = decrypt_json_payload(conn.encrypted_credentials, settings.integration_encryption_key.get_secret_value())
        secret = creds.get("signing_secret", secret)

    ok, reason = verify_inbound_webhook(
        secret=secret,
        timestamp_header=request.headers.get("X-Scribble-Timestamp"),
        signature_header=request.headers.get("X-Scribble-Signature-256"),
        payload_bytes=body_bytes,
        replay_window_seconds=settings.webhook_replay_window_seconds,
    )
    if not ok:
        raise AuthenticationError(reason)

    parsed_body = json.loads(body_bytes.decode("utf-8") or "{}")
    await AuditService.log_event(
        db,
        organization_id=org.id,
        actor_email="webhook@inbound",
        actor_portal="system",
        module="webhooks",
        action="webhook.inbound_verified",
        entity_type="organization",
        entity_id=str(org.id),
        summary=f"Verified signed inbound webhook event '{parsed_body.get('event', 'unknown')}'",
        request=request,
    )
    await db.commit()
    return {"accepted": True, "organization_slug": org.slug}


@router.get("/telephony/calls", response_model=list[TelephonyCallOut])
async def list_telephony_calls(
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[TelephonyCallOut]:
    return await IntegrationsService.list_calls(db, principal=principal)


@router.post("/telephony/calls/outbound", response_model=TelephonyCallOut, status_code=status.HTTP_201_CREATED)
async def create_outbound_call(
    payload: OutboundCallRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> TelephonyCallOut:
    return await IntegrationsService.place_outbound_call(db, principal=principal, payload=payload, request=request)


@router.post("/telephony/webhooks/twilio/{org_slug}")
async def receive_twilio_webhook(
    org_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Twilio voice/status callback verified with X-Twilio-Signature (HMAC-SHA1)."""
    settings = get_settings()
    form_data = dict(await request.form())
    str_params = {str(k): str(v) for k, v in form_data.items()}

    await set_transaction_tenant_context(db, bypass_rls=True)
    org = await IntegrationsService.resolve_org_by_slug(db, org_slug)
    if not org:
        raise NotFoundError("Organization not found.")

    await set_transaction_tenant_context(db, organization_id=org.id)
    conn = (
        await db.execute(
            select(IntegrationConnection).where(
                IntegrationConnection.organization_id == org.id,
                IntegrationConnection.provider == "twilio",
                IntegrationConnection.status == "active",
            )
        )
    ).scalar_one_or_none()

    auth_token = settings.twilio_auth_token.get_secret_value()
    if conn and conn.encrypted_credentials:
        creds = decrypt_json_payload(conn.encrypted_credentials, settings.integration_encryption_key.get_secret_value())
        auth_token = creds.get("auth_token", auth_token)

    if not verify_twilio_signature(
        auth_token=auth_token,
        full_url=str(request.url),
        form_params=str_params,
        signature_header=request.headers.get("X-Twilio-Signature"),
    ):
        raise AuthenticationError("Invalid Twilio webhook signature.")

    call_sid = str_params.get("CallSid", "")
    call_status = str_params.get("CallStatus", "ringing").lower()
    mapped_status = call_status if call_status in {"queued", "ringing", "active", "on_hold", "completed", "failed", "missed"} else "active"

    call = TelephonyCallLog(
        organization_id=org.id,
        provider="twilio",
        provider_call_sid=call_sid or None,
        direction="inbound",
        status=mapped_status,
        from_number=str_params.get("From", ""),
        to_number=str_params.get("To", ""),
        caller_name=str_params.get("CallerName", ""),
        duration_seconds=int(str_params.get("CallDuration", "0") or "0"),
    )
    db.add(call)
    await db.commit()
    return {"accepted": True, "call_sid": call_sid}


@router.post("/notifications/dispatch", response_model=BackgroundJobOut, status_code=status.HTTP_202_ACCEPTED)
async def dispatch_external_notification(
    payload: NotificationDispatchRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> BackgroundJobOut:
    return await IntegrationsService.enqueue_notification_dispatch(
        db,
        principal=principal,
        payload=payload,
        request=request,
    )


@router.get("/jobs", response_model=list[BackgroundJobOut])
async def list_background_jobs(
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[BackgroundJobOut]:
    return await IntegrationsService.list_jobs(db, principal=principal)
