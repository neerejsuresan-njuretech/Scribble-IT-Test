from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.tenant import AuthenticatedPrincipal, get_current_principal
from app.db.session import get_db_session
from app.modules.notifications.schemas import (
    PushDeliveryLogListResponse,
    PushDeliveryLogOut,
    PushDispatchRequest,
    PushDispatchResponse,
    PushTokenListResponse,
    PushTokenOut,
    PushTokenRegisterRequest,
    PushTokenRevokeByValueRequest,
)
from app.modules.notifications.service import PushNotificationService

router = APIRouter(prefix="/notifications", tags=["Push Notifications"])


@router.post(
    "/push-tokens",
    response_model=PushTokenOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register or refresh a mobile device push token",
)
async def register_push_token(
    payload: PushTokenRegisterRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> PushTokenOut:
    row = await PushNotificationService.register_token(
        db,
        principal=principal,
        payload=payload,
        settings=settings,
        request=request,
    )
    return PushTokenOut.model_validate(row)


@router.get(
    "/push-tokens",
    response_model=PushTokenListResponse,
    summary="List authenticated user's registered device push tokens",
)
async def list_push_tokens(
    include_revoked: bool = Query(default=False),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> PushTokenListResponse:
    rows = await PushNotificationService.list_own_tokens(
        db, principal=principal, include_revoked=include_revoked
    )
    items = [PushTokenOut.model_validate(r) for r in rows]
    return PushTokenListResponse(items=items, total=len(items))


@router.delete(
    "/push-tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a registered device push token by ID",
)
async def revoke_push_token(
    token_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    await PushNotificationService.revoke_token_by_id(
        db, principal=principal, token_id=token_id, request=request
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/push-tokens/revoke",
    summary="Revoke a registered device push token by raw token value",
)
async def revoke_push_token_by_value(
    payload: PushTokenRevokeByValueRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    revoked = await PushNotificationService.revoke_token_by_value(
        db,
        principal=principal,
        raw_push_token=payload.push_token,
        reason=payload.reason,
        request=request,
    )
    return {"revoked": revoked}


@router.post(
    "/push/dispatch",
    response_model=PushDispatchResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue push notifications for target users in the active organization",
)
async def dispatch_push_notifications(
    payload: PushDispatchRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> PushDispatchResponse:
    delivery_ids, job_ids = await PushNotificationService.enqueue_push_notification(
        db, principal=principal, payload=payload, request=request
    )
    return PushDispatchResponse(
        queued_count=len(delivery_ids),
        delivery_ids=delivery_ids,
        job_ids=job_ids,
    )


@router.get(
    "/push/deliveries",
    response_model=PushDeliveryLogListResponse,
    summary="List tenant-scoped push notification delivery logs",
)
async def list_push_deliveries(
    target_user_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> PushDeliveryLogListResponse:
    rows, total = await PushNotificationService.list_delivery_logs(
        db,
        principal=principal,
        target_user_id=target_user_id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return PushDeliveryLogListResponse(
        items=[PushDeliveryLogOut.model_validate(r) for r in rows],
        total=total,
    )
