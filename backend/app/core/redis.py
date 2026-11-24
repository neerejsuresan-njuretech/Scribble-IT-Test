from __future__ import annotations

import logging
import time
from typing import Any

from redis.asyncio import ConnectionPool, Redis

from app.core.config import Settings

logger = logging.getLogger("scribble_it.redis")


class RedisManager:
    """Manages async Redis connection pool lifecycle and health checks."""

    def __init__(self) -> None:
        self._pool: ConnectionPool | None = None
        self._client: Redis | None = None

    def init(self, settings: Settings) -> None:
        if self._client is not None:
            return
        self._pool = ConnectionPool.from_url(
            settings.redis_url,
            max_connections=settings.redis_max_connections,
            socket_timeout=settings.redis_socket_timeout_seconds,
            socket_connect_timeout=settings.redis_socket_timeout_seconds,
            decode_responses=True,
        )
        self._client = Redis(connection_pool=self._pool)
        logger.info("Initialized Redis async connection pool")

    @property
    def client(self) -> Redis:
        if self._client is None:
            raise RuntimeError("RedisManager has not been initialized.")
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
        if self._pool is not None:
            await self._pool.disconnect()
            self._pool = None
            logger.info("Closed Redis async connection pool")

    async def check_health(self) -> dict[str, Any]:
        if self._client is None:
            return {"status": "error", "detail": "Redis client not initialized"}
        started = time.perf_counter()
        try:
            pong = await self._client.ping()
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            if pong:
                return {"status": "ok", "latency_ms": latency_ms}
            return {"status": "error", "latency_ms": latency_ms, "detail": "Unexpected PING response"}
        except Exception as exc:
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.warning(
                "Redis health check failed",
                extra={"extra_fields": {"error_type": type(exc).__name__, "latency_ms": latency_ms}},
            )
            return {"status": "error", "latency_ms": latency_ms, "detail": "Redis unavailable"}


redis_manager = RedisManager()


def get_redis() -> Redis:
    """FastAPI dependency returning the initialized async Redis client."""
    return redis_manager.client
