from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_after_seconds: int


class SlidingWindowRateLimiter:
    """
    Production sliding-window rate limiter supporting Redis sorted sets
    with an asyncio-safe in-memory fallback for standalone tests or degraded Redis.
    """

    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = {}
        self._lock = asyncio.Lock()

    async def check(
        self,
        key: str,
        *,
        limit: int,
        window_seconds: int,
        redis_client=None,
    ) -> RateLimitResult:
        now = time.time()
        window_start = now - window_seconds

        if redis_client is not None:
            try:
                member = f"{now:.6f}:{id(key)}"
                pipe = redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zadd(key, {member: now})
                pipe.zcard(key)
                pipe.expire(key, window_seconds + 5)
                results = await pipe.execute()
                count = int(results[2])
                allowed = count <= limit
                remaining = max(0, limit - count)
                return RateLimitResult(
                    allowed=allowed,
                    limit=limit,
                    remaining=remaining,
                    reset_after_seconds=window_seconds,
                )
            except Exception:
                # Fall back to local memory window rather than failing open silently
                pass

        async with self._lock:
            bucket = self._buckets.setdefault(key, deque())
            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= limit:
                oldest = bucket[0]
                retry_after = max(1, int(window_seconds - (now - oldest)))
                return RateLimitResult(
                    allowed=False,
                    limit=limit,
                    remaining=0,
                    reset_after_seconds=retry_after,
                )

            bucket.append(now)
            return RateLimitResult(
                allowed=True,
                limit=limit,
                remaining=max(0, limit - len(bucket)),
                reset_after_seconds=window_seconds,
            )

    def reset_local(self) -> None:
        self._buckets.clear()


rate_limiter = SlidingWindowRateLimiter()
