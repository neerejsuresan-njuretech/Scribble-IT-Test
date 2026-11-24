from __future__ import annotations

import logging
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings

logger = logging.getLogger("scribble_it.database")


class DatabaseManager:
    """
    Manages the async SQLAlchemy 2.x engine, connection pool, and session lifecycle.
    Uses DATABASE_URL exclusively (restricted non-superuser runtime role).
    """

    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

    def init(self, settings: Settings) -> None:
        if self._engine is not None:
            return

        self._engine = create_async_engine(
            settings.database_url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout_seconds,
            pool_recycle=settings.db_pool_recycle_seconds,
            pool_pre_ping=True,
            echo=settings.db_echo_sql,
        )
        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
        logger.info(
            "Initialized PostgreSQL async engine",
            extra={
                "extra_fields": {
                    "pool_size": settings.db_pool_size,
                    "max_overflow": settings.db_max_overflow,
                    "runtime_role": settings.runtime_db_username,
                }
            },
        )

    @property
    def engine(self) -> AsyncEngine:
        if self._engine is None:
            raise RuntimeError("DatabaseManager has not been initialized.")
        return self._engine

    @property
    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        if self._session_factory is None:
            raise RuntimeError("DatabaseManager has not been initialized.")
        return self._session_factory

    async def close(self) -> None:
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            self._session_factory = None
            logger.info("Disposed PostgreSQL async engine")

    async def check_health(self) -> dict[str, Any]:
        if self._engine is None:
            return {"status": "error", "detail": "Database engine not initialized"}

        started = time.perf_counter()
        try:
            async with self._engine.connect() as conn:
                row = (
                    await conn.execute(
                        text(
                            "SELECT 1 AS ok, current_user AS db_user, "
                            "(SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser"
                        )
                    )
                ).mappings().one()
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            return {
                "status": "ok",
                "latency_ms": latency_ms,
                "role_verified_non_superuser": not bool(row["is_superuser"]),
            }
        except Exception as exc:
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.warning(
                "Database health check failed",
                extra={"extra_fields": {"error_type": type(exc).__name__, "latency_ms": latency_ms}},
            )
            return {"status": "error", "latency_ms": latency_ms, "detail": "Database unavailable"}


db_manager = DatabaseManager()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI request-scoped async database session dependency.
    Commits cleanly on success and rolls back automatically on unhandled exceptions.
    """
    session_factory = db_manager.session_factory
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def set_transaction_tenant_context(
    session: AsyncSession,
    organization_id: uuid.UUID,
) -> None:
    """
    Establishes transaction-local PostgreSQL RLS tenant context.
    The third argument `true` scopes both GUCs strictly to the current transaction
    so pooled connections never bleed tenant context across requests.
    """
    await session.execute(
        text(
            "SELECT set_config('app.rls_bypass', 'off', true), "
            "set_config('app.current_organization_id', :org_id, true)"
        ),
        {"org_id": str(organization_id)},
    )


async def enable_transaction_platform_lookup(session: AsyncSession) -> None:
    """
    Enables transaction-local RLS bypass ONLY for server-internal pre-auth lookups
    (login, refresh-token resolution, device enrollment redemption) or verified
    platform Super Admin cross-tenant operations. Never exposed to user input.
    """
    await session.execute(text("SELECT set_config('app.rls_bypass', 'on', true)"))

