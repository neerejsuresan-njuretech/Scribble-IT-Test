from __future__ import annotations

import asyncio
import logging
import signal
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.crypto import decrypt_json_payload, decrypt_secret
from app.core.logging import configure_logging
from app.core.redis import redis_manager
from app.core.ssrf import validate_outbound_url
from app.db.models.integrations import (
    BackgroundJob,
    IntegrationConnection,
    WebhookEndpoint,
)
from app.db.session import db_manager, enable_transaction_platform_lookup, set_transaction_tenant_context
from app.modules.integrations.adapters import WebhookDeliveryAdapter

logger = logging.getLogger("scribble_it.worker")


def compute_backoff_seconds(attempt: int) -> int:
    """Exponential retry backoff capped at 1 hour (15s, 30s, 60s, 120s, ...)."""
    return min(3600, 15 * (2 ** max(0, attempt - 1)))


async def _execute_webhook_delivery(
    session: AsyncSession,
    *,
    job: BackgroundJob,
    settings: Settings,
) -> None:
    payload = job.payload_json or {}
    webhook_id = uuid.UUID(str(payload["webhook_id"]))
    event_type = str(payload.get("event_type", "system.event"))
    event_data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    await set_transaction_tenant_context(session, organization_id=job.organization_id)
    wh = (
        await session.execute(
            select(WebhookEndpoint).where(
                WebhookEndpoint.id == webhook_id,
                WebhookEndpoint.organization_id == job.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not wh or not wh.is_active:
        raise RuntimeError(f"Webhook endpoint {webhook_id} missing or inactive.")

    master_key = settings.integration_encryption_key.get_secret_value()
    signing_secret = decrypt_secret(wh.encrypted_signing_secret, master_key)
    status_code, resp_excerpt = await WebhookDeliveryAdapter.deliver(
        target_url=wh.target_url,
        signing_secret=signing_secret,
        event_type=event_type,
        payload=event_data,
        allow_http_in_test=(settings.app_env == "test"),
    )
    wh.last_delivery_status = status_code
    wh.last_delivered_at = datetime.now(timezone.utc)
    if status_code < 200 or status_code >= 300:
        raise RuntimeError(f"Webhook endpoint returned HTTP {status_code}: {resp_excerpt[:200]}")


async def _execute_external_notification(
    session: AsyncSession,
    *,
    job: BackgroundJob,
    settings: Settings,
) -> None:
    payload = job.payload_json or {}
    connection_id = uuid.UUID(str(payload["connection_id"]))
    subject = str(payload.get("subject", "Scribble-IT Notification"))
    message = str(payload.get("message", ""))
    severity = str(payload.get("severity", "info"))
    channel = str(payload.get("channel", ""))

    await set_transaction_tenant_context(session, organization_id=job.organization_id)
    conn = (
        await session.execute(
            select(IntegrationConnection).where(
                IntegrationConnection.id == connection_id,
                IntegrationConnection.organization_id == job.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not conn or conn.status != "active":
        raise RuntimeError(f"Notification provider connection {connection_id} missing or inactive.")

    master_key = settings.integration_encryption_key.get_secret_value()
    creds: dict[str, Any] = (
        decrypt_json_payload(conn.encrypted_credentials, master_key)
        if conn.encrypted_credentials
        else {}
    )
    webhook_url = str(creds.get("webhook_url") or conn.config_json.get("webhook_url") or "").strip()
    if not webhook_url:
        raise RuntimeError("Notification provider connection has no webhook_url configured.")

    safe_url = validate_outbound_url(webhook_url, allow_http_in_test=(settings.app_env == "test"))
    body = {
        "provider": conn.provider,
        "channel": channel,
        "severity": severity,
        "subject": subject,
        "text": f"[{severity.upper()}] {subject}\n{message}",
    }
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        resp = await client.post(safe_url, json=body)
        if resp.status_code >= 400:
            raise RuntimeError(f"Notification provider returned HTTP {resp.status_code}: {resp.text[:200]}")
    conn.last_synced_at = datetime.now(timezone.utc)
    conn.last_error = None


async def process_single_job(session: AsyncSession, job: BackgroundJob, settings: Settings) -> str:
    """Executes one claimed background job and updates retry/dead-letter state."""
    job.attempts += 1
    job.status = "running"
    await session.flush()

    try:
        if job.job_type == "webhook_delivery":
            await _execute_webhook_delivery(session, job=job, settings=settings)
        elif job.job_type == "external_notification":
            await _execute_external_notification(session, job=job, settings=settings)
        else:
            raise RuntimeError(f"Unsupported background job_type '{job.job_type}'.")

        job.status = "succeeded"
        job.completed_at = datetime.now(timezone.utc)
        job.last_error = None
        return "succeeded"
    except Exception as exc:
        err_text = f"{type(exc).__name__}: {str(exc)[:450]}"
        job.last_error = err_text
        if job.attempts >= job.max_attempts:
            job.status = "dead_letter"
            logger.error(
                "Background job moved to dead_letter",
                extra={"extra_fields": {"job_id": str(job.id), "job_type": job.job_type, "error": err_text}},
            )
            return "dead_letter"
        backoff = compute_backoff_seconds(job.attempts)
        job.status = "retrying"
        job.next_run_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
        logger.warning(
            "Background job scheduled for retry",
            extra={
                "extra_fields": {
                    "job_id": str(job.id),
                    "job_type": job.job_type,
                    "attempt": job.attempts,
                    "backoff_seconds": backoff,
                }
            },
        )
        return "retrying"


async def run_worker_cycle(settings: Settings, *, batch_size: int = 10) -> int:
    """Claims up to batch_size due jobs using FOR UPDATE SKIP LOCKED and processes them."""
    processed = 0
    now = datetime.now(timezone.utc)
    async with db_manager.session_factory() as session:
        await enable_transaction_platform_lookup(session)
        jobs = (
            await session.execute(
                select(BackgroundJob)
                .where(
                    BackgroundJob.status.in_(["queued", "retrying"]),
                    BackgroundJob.next_run_at <= now,
                )
                .order_by(BackgroundJob.next_run_at.asc())
                .limit(batch_size)
                .with_for_update(skip_locked=True)
            )
        ).scalars().all()

        for job in jobs:
            await process_single_job(session, job, settings)
            processed += 1

        await session.commit()
    return processed


async def run_worker_forever(poll_interval_seconds: float = 2.0) -> None:
    """Long-running background worker entrypoint with Redis heartbeat and graceful shutdown."""
    settings = get_settings()
    configure_logging(level=settings.log_level, json_format=settings.log_json)
    db_manager.init(settings)
    await redis_manager.init(settings)

    stop_event = asyncio.Event()

    def _signal_handler() -> None:
        logger.info("Worker received shutdown signal; finishing active batch.")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            pass

    logger.info("Scribble-IT background worker started", extra={"extra_fields": {"env": settings.app_env}})
    try:
        while not stop_event.is_set():
            try:
                client = getattr(redis_manager, "client", None)
                if client is not None:
                    await client.set("scribble:worker:heartbeat", str(int(time.time())), ex=60)
                processed = await run_worker_cycle(settings)
                if processed == 0:
                    try:
                        await asyncio.wait_for(stop_event.wait(), timeout=poll_interval_seconds)
                    except asyncio.TimeoutError:
                        pass
            except Exception as exc:
                logger.exception("Worker loop error: %s", exc)
                await asyncio.sleep(poll_interval_seconds)
    finally:
        await redis_manager.close()
        await db_manager.close()
        logger.info("Scribble-IT background worker stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(run_worker_forever())
