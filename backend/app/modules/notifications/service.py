from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Request
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_meta import resolve_client_metadata
from app.core.config import Settings
from app.core.crypto import decrypt_json_payload, decrypt_secret, encrypt_secret, mask_secret
from app.core.exceptions import AuthorizationError, NotFoundError, ValidationDomainError
from app.core.security import enforce_rate_limit, hash_token
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.device_trust import ManagedDevice
from app.db.models.integrations import BackgroundJob, IntegrationConnection
from app.db.models.push_notifications import DevicePushToken, PushDeliveryLog
from app.db.session import set_transaction_tenant_context
from app.modules.audit.service import AuditService
from app.modules.notifications.adapters import ApnsPushAdapter, FcmPushAdapter, PushSendResult
from app.modules.notifications.schemas import (
    PushDispatchRequest,
    PushTokenRegisterRequest,
)


class PushNotificationService:
    """
    Tenant-isolated push token registration, revocation, delivery queueing,
    and backend-only FCM / APNs provider execution.
    """

    @staticmethod
    async def register_token(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: PushTokenRegisterRequest,
        settings: Settings,
        request: Request | None = None,
    ) -> DevicePushToken:
        await enforce_rate_limit(
            bucket="push_register",
            identifier=f"{principal.organization_id}:{principal.user_id}",
            max_requests=30,
            window_seconds=300,
        )

        # Validate native client metadata consistency when supplied
        meta = resolve_client_metadata(
            request=request,
            settings=settings,
            body_client_type="mobile",
            body_client_platform=payload.platform,
            body_app_version=payload.app_version or "1.0.0",
            body_app_id=payload.app_id,
            body_device_name=payload.device_name,
        )

        await set_transaction_tenant_context(db, principal.organization_id)

        # Verify optional device_id belongs to this organization and is active/accessible
        verified_device_id: uuid.UUID | None = None
        if payload.device_id is not None:
            device = (
                await db.execute(
                    select(ManagedDevice).where(
                        ManagedDevice.id == payload.device_id,
                        ManagedDevice.organization_id == principal.organization_id,
                        ManagedDevice.status == "active",
                    )
                )
            ).scalar_one_or_none()
            if device is None:
                raise NotFoundError("Specified managed device was not found or is revoked.")
            if device.bound_user_id is not None and device.bound_user_id != principal.user_id:
                raise AuthorizationError("Cannot bind a push token to another user's managed device.")
            verified_device_id = device.id

        master_key = settings.integration_encryption_key.get_secret_value()
        token_digest = hash_token(payload.push_token)
        encrypted_token = encrypt_secret(payload.push_token, master_key)
        preview = mask_secret(payload.push_token)[:32]
        now = datetime.now(timezone.utc)

        existing = (
            await db.execute(
                select(DevicePushToken).where(
                    DevicePushToken.organization_id == principal.organization_id,
                    DevicePushToken.push_token_hash == token_digest,
                )
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.user_id = principal.user_id
            existing.session_id = principal.session_id
            existing.device_id = verified_device_id
            existing.provider = payload.provider
            existing.platform = payload.platform
            existing.app_id = meta.app_id
            existing.app_version = payload.app_version or meta.app_version
            existing.device_name = meta.device_name
            existing.push_token_encrypted = encrypted_token
            existing.token_preview = preview
            existing.status = "active"
            existing.last_registered_at = now
            existing.revoked_at = None
            existing.revocation_reason = None
            row = existing
        else:
            row = DevicePushToken(
                organization_id=principal.organization_id,
                user_id=principal.user_id,
                session_id=principal.session_id,
                device_id=verified_device_id,
                provider=payload.provider,
                platform=payload.platform,
                app_id=meta.app_id,
                app_version=payload.app_version or meta.app_version,
                device_name=meta.device_name,
                push_token_hash=token_digest,
                push_token_encrypted=encrypted_token,
                token_preview=preview,
                status="active",
                last_registered_at=now,
            )
            db.add(row)

        await db.flush()

        await AuditService.record(
            db,
            action="PUSH_TOKEN_REGISTERED",
            module="notifications",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="device_push_token",
            target_id=str(row.id),
            outcome="success",
            detail=f"Registered {row.provider}/{row.platform} push token ({row.token_preview}).",
            metadata={
                "provider": row.provider,
                "platform": row.platform,
                "device_id": str(verified_device_id) if verified_device_id else None,
                "app_version": row.app_version,
            },
            request=request,
        )
        return row

    @staticmethod
    async def list_own_tokens(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        include_revoked: bool = False,
    ) -> list[DevicePushToken]:
        await set_transaction_tenant_context(db, principal.organization_id)
        stmt = select(DevicePushToken).where(
            DevicePushToken.organization_id == principal.organization_id,
            DevicePushToken.user_id == principal.user_id,
        )
        if not include_revoked:
            stmt = stmt.where(DevicePushToken.status == "active")
        stmt = stmt.order_by(desc(DevicePushToken.last_registered_at))
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def revoke_token_by_id(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        token_id: uuid.UUID,
        reason: str = "user_revoked",
        request: Request | None = None,
    ) -> None:
        await set_transaction_tenant_context(db, principal.organization_id)
        row = (
            await db.execute(
                select(DevicePushToken).where(
                    DevicePushToken.id == token_id,
                    DevicePushToken.organization_id == principal.organization_id,
                )
            )
        ).scalar_one_or_none()
        if row is None:
            raise NotFoundError("Push token registration not found.")

        # Strict ownership check: users can only revoke their own tokens unless holding iam:manage
        if row.user_id != principal.user_id and not principal.has_permission("iam:manage"):
            raise AuthorizationError("You are not authorized to revoke another user's push token.")

        now = datetime.now(timezone.utc)
        row.status = "revoked"
        row.revoked_at = now
        row.revocation_reason = reason[:128]
        await db.flush()

        await AuditService.record(
            db,
            action="PUSH_TOKEN_REVOKED",
            module="notifications",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="device_push_token",
            target_id=str(row.id),
            outcome="success",
            detail=f"Revoked {row.provider}/{row.platform} push token ({row.token_preview}).",
            metadata={"reason": row.revocation_reason, "owner_user_id": str(row.user_id)},
            request=request,
        )

    @staticmethod
    async def revoke_token_by_value(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        raw_push_token: str,
        reason: str = "user_unregistered",
        request: Request | None = None,
    ) -> bool:
        await set_transaction_tenant_context(db, principal.organization_id)
        digest = hash_token(raw_push_token.strip())
        row = (
            await db.execute(
                select(DevicePushToken).where(
                    DevicePushToken.organization_id == principal.organization_id,
                    DevicePushToken.user_id == principal.user_id,
                    DevicePushToken.push_token_hash == digest,
                )
            )
        ).scalar_one_or_none()
        if row is None:
            return False

        now = datetime.now(timezone.utc)
        row.status = "revoked"
        row.revoked_at = now
        row.revocation_reason = reason[:128]
        await db.flush()

        await AuditService.record(
            db,
            action="PUSH_TOKEN_REVOKED",
            module="notifications",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="device_push_token",
            target_id=str(row.id),
            outcome="success",
            detail=f"Unregistered {row.provider}/{row.platform} push token ({row.token_preview}).",
            metadata={"reason": row.revocation_reason},
            request=request,
        )
        return True

    @staticmethod
    async def enqueue_push_notification(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: PushDispatchRequest,
        request: Request | None = None,
    ) -> tuple[list[uuid.UUID], list[uuid.UUID]]:
        """
        Enqueues tenant-scoped push deliveries for all active device push tokens belonging
        to the requested target_user_ids inside the caller's verified organization.
        """
        can_broadcast = (
            principal.has_permission("incidents:write")
            or principal.has_permission("workflows:manage")
            or principal.has_permission("iam:manage")
            or principal.is_super_admin
        )
        if not can_broadcast:
            # Standard end users may only trigger a self-test push to their own user_id
            if set(payload.target_user_ids) != {principal.user_id}:
                raise AuthorizationError(
                    "Dispatching push notifications to other users requires operational permissions."
                )

        await enforce_rate_limit(
            bucket="push_dispatch",
            identifier=f"{principal.organization_id}:{principal.user_id}",
            max_requests=60,
            window_seconds=60,
        )

        await set_transaction_tenant_context(db, principal.organization_id)
        tokens = list(
            (
                await db.execute(
                    select(DevicePushToken).where(
                        DevicePushToken.organization_id == principal.organization_id,
                        DevicePushToken.user_id.in_(payload.target_user_ids),
                        DevicePushToken.status == "active",
                    )
                )
            )
            .scalars()
            .all()
        )

        delivery_ids: list[uuid.UUID] = []
        job_ids: list[uuid.UUID] = []
        now = datetime.now(timezone.utc)

        for tok in tokens:
            delivery = PushDeliveryLog(
                organization_id=principal.organization_id,
                push_token_id=tok.id,
                target_user_id=tok.user_id,
                provider=tok.provider,
                platform=tok.platform,
                title=payload.title.strip(),
                body=payload.body.strip(),
                data_json=payload.data or {},
                status="queued",
                attempts=0,
            )
            db.add(delivery)
            await db.flush()

            job = BackgroundJob(
                organization_id=principal.organization_id,
                job_type="push_notification_delivery",
                payload_json={
                    "delivery_log_id": str(delivery.id),
                    "push_token_id": str(tok.id),
                    "priority": payload.priority,
                },
                status="queued",
                attempts=0,
                max_attempts=payload.max_attempts,
                next_run_at=now,
            )
            db.add(job)
            await db.flush()

            delivery.background_job_id = job.id
            delivery_ids.append(delivery.id)
            job_ids.append(job.id)

        await db.flush()

        await AuditService.record(
            db,
            action="PUSH_NOTIFICATIONS_QUEUED",
            module="notifications",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="push_delivery_batch",
            target_id=str(delivery_ids[0]) if delivery_ids else None,
            outcome="success",
            detail=f"Queued {len(delivery_ids)} push notification delivery job(s).",
            metadata={
                "target_user_count": len(payload.target_user_ids),
                "queued_deliveries": len(delivery_ids),
                "priority": payload.priority,
            },
            request=request,
        )
        return delivery_ids, job_ids

    @staticmethod
    async def list_delivery_logs(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        target_user_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[PushDeliveryLog], int]:
        await set_transaction_tenant_context(db, principal.organization_id)
        can_view_org = (
            principal.has_permission("audit:read")
            or principal.has_permission("iam:manage")
            or principal.has_permission("workflows:manage")
            or principal.is_super_admin
        )
        conditions = [PushDeliveryLog.organization_id == principal.organization_id]
        if can_view_org:
            if target_user_id is not None:
                conditions.append(PushDeliveryLog.target_user_id == target_user_id)
        else:
            if target_user_id is not None and target_user_id != principal.user_id:
                raise AuthorizationError(
                    "You are not authorized to view another user's push delivery logs."
                )
            conditions.append(PushDeliveryLog.target_user_id == principal.user_id)

        if status_filter:
            conditions.append(PushDeliveryLog.status == status_filter.strip())

        total = int(
            (await db.execute(select(func.count(PushDeliveryLog.id)).where(*conditions))).scalar_one()
        )
        rows = list(
            (
                await db.execute(
                    select(PushDeliveryLog)
                    .where(*conditions)
                    .order_by(desc(PushDeliveryLog.created_at))
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return rows, total

    @staticmethod
    async def resolve_provider_credentials(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        provider: str,
        settings: Settings,
    ) -> dict[str, Any]:
        """
        Resolves backend-only FCM or APNs credentials from an active tenant IntegrationConnection
        first, falling back to environment-configured server credentials.
        Credentials are NEVER returned to clients.
        """
        master_key = settings.integration_encryption_key.get_secret_value()
        conn = (
            await db.execute(
                select(IntegrationConnection)
                .where(
                    IntegrationConnection.organization_id == organization_id,
                    IntegrationConnection.provider == provider,
                    IntegrationConnection.status == "active",
                )
                .order_by(desc(IntegrationConnection.created_at))
                .limit(1)
            )
        ).scalar_one_or_none()

        creds: dict[str, Any] = {}
        cfg: dict[str, Any] = {}
        if conn is not None:
            cfg = dict(conn.config_json or {})
            if conn.encrypted_credentials:
                creds = decrypt_json_payload(conn.encrypted_credentials, master_key)

        if provider == "fcm":
            project_id = str(creds.get("project_id") or cfg.get("project_id") or settings.fcm_project_id).strip()
            client_email = str(
                creds.get("client_email") or cfg.get("client_email") or settings.fcm_client_email
            ).strip()
            private_key = str(
                creds.get("private_key") or settings.fcm_private_key.get_secret_value()
            ).strip()
            if not (project_id and client_email and private_key):
                raise ValidationDomainError(
                    "FCM push provider credentials are not configured on the backend."
                )
            return {
                "project_id": project_id,
                "client_email": client_email,
                "private_key": private_key,
            }

        if provider == "apns":
            team_id = str(creds.get("team_id") or cfg.get("team_id") or settings.apns_team_id).strip()
            key_id = str(creds.get("key_id") or cfg.get("key_id") or settings.apns_key_id).strip()
            bundle_id = str(
                creds.get("bundle_id") or cfg.get("bundle_id") or settings.apns_bundle_id
            ).strip()
            private_key = str(
                creds.get("private_key") or settings.apns_private_key.get_secret_value()
            ).strip()
            use_sandbox = bool(cfg.get("use_sandbox", settings.apns_use_sandbox))
            if not (team_id and key_id and bundle_id and private_key):
                raise ValidationDomainError(
                    "APNs push provider credentials are not configured on the backend."
                )
            return {
                "team_id": team_id,
                "key_id": key_id,
                "bundle_id": bundle_id,
                "private_key": private_key,
                "use_sandbox": use_sandbox,
            }

        raise ValidationDomainError(f"Unsupported push provider '{provider}'.")

    @staticmethod
    async def execute_delivery_job(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        delivery_log_id: uuid.UUID,
        priority: str,
        settings: Settings,
        transport: Any | None = None,
    ) -> PushSendResult:
        """
        Executes a single queued push notification delivery from the background worker,
        recording provider response status and automatically revoking permanently invalid tokens.
        """
        await set_transaction_tenant_context(db, organization_id)

        delivery = (
            await db.execute(
                select(PushDeliveryLog).where(
                    PushDeliveryLog.id == delivery_log_id,
                    PushDeliveryLog.organization_id == organization_id,
                )
            )
        ).scalar_one_or_none()
        if delivery is None:
            raise RuntimeError(f"PushDeliveryLog {delivery_log_id} not found.")

        delivery.attempts += 1
        now = datetime.now(timezone.utc)

        if delivery.push_token_id is None:
            delivery.status = "skipped"
            delivery.error_code = "TOKEN_MISSING"
            delivery.error_message = "Associated push token record no longer exists."
            await db.flush()
            return PushSendResult(delivered=False, http_status=0, error_code="TOKEN_MISSING")

        token_row = (
            await db.execute(
                select(DevicePushToken).where(
                    DevicePushToken.id == delivery.push_token_id,
                    DevicePushToken.organization_id == organization_id,
                )
            )
        ).scalar_one_or_none()
        if token_row is None or token_row.status != "active":
            delivery.status = "skipped"
            delivery.error_code = "TOKEN_INACTIVE"
            delivery.error_message = "Device push token was revoked or invalidated prior to send."
            await db.flush()
            return PushSendResult(delivered=False, http_status=0, error_code="TOKEN_INACTIVE")

        creds = await PushNotificationService.resolve_provider_credentials(
            db,
            organization_id=organization_id,
            provider=token_row.provider,
            settings=settings,
        )

        master_key = settings.integration_encryption_key.get_secret_value()
        raw_device_token = decrypt_secret(token_row.push_token_encrypted, master_key)

        if token_row.provider == "fcm":
            result = await FcmPushAdapter.send(
                project_id=creds["project_id"],
                client_email=creds["client_email"],
                private_key_pem=creds["private_key"],
                device_token=raw_device_token,
                title=delivery.title,
                body=delivery.body,
                data=delivery.data_json,
                priority=priority,
                transport=transport,
            )
        else:
            result = await ApnsPushAdapter.send(
                team_id=creds["team_id"],
                key_id=creds["key_id"],
                bundle_id=creds["bundle_id"],
                private_key_pem=creds["private_key"],
                device_token=raw_device_token,
                title=delivery.title,
                body=delivery.body,
                data=delivery.data_json,
                priority=priority,
                use_sandbox=creds["use_sandbox"],
                transport=transport,
            )

        delivery.http_status = result.http_status
        delivery.provider_message_id = result.provider_message_id
        delivery.error_code = result.error_code
        delivery.error_message = result.error_message

        if result.delivered:
            delivery.status = "delivered"
            delivery.sent_at = now
            delivery.next_retry_at = None
            token_row.last_delivered_at = now
            await db.flush()
            return result

        if result.permanent_token_invalid:
            delivery.status = "revoked_token"
            delivery.next_retry_at = None
            token_row.status = "invalid_token"
            token_row.revoked_at = now
            token_row.revocation_reason = f"provider_invalid:{result.error_code or result.http_status}"[:128]
            await db.flush()
            return result

        # Retryable or non-token failure — surface to worker for backoff / dead_letter
        delivery.status = "retrying" if result.retryable else "failed"
        await db.flush()
        return result
