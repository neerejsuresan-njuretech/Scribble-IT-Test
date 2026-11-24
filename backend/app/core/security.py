from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings
from app.core.exceptions import AuthenticationError, RateLimitError
from app.core.redis import redis_manager

# OWASP-aligned Argon2id configuration (memory=64 MiB, time=3, parallelism=4)
_ARGON2_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

_ENROLLMENT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_LOCAL_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def hash_password(plain_password: str) -> str:
    """Hash a user password using Argon2id."""
    if not plain_password or len(plain_password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    return _ARGON2_HASHER.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a password against an Argon2id PHC hash in constant time."""
    if not plain_password or not password_hash:
        return False
    try:
        return bool(_ARGON2_HASHER.verify(password_hash, plain_password))
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    """Return True if an Argon2id hash was created with weaker parameters."""
    try:
        return _ARGON2_HASHER.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def hash_token(raw_token: str) -> str:
    """Deterministic SHA-256 hex digest for storing refresh, reset, or device enrollment tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def constant_time_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def generate_opaque_token(num_bytes: int = 48) -> str:
    """Generate a high-entropy URL-safe opaque token."""
    return secrets.token_urlsafe(num_bytes)


def generate_device_enrollment_code() -> str:
    """Generate a corporate IAM verification code in the preserved IAM-XXXX-XXXX format."""
    part1 = "".join(secrets.choice(_ENROLLMENT_ALPHABET) for _ in range(4))
    part2 = "".join(secrets.choice(_ENROLLMENT_ALPHABET) for _ in range(4))
    return f"IAM-{part1}-{part2}"


def generate_certificate_thumbprint() -> str:
    """Generate a deterministic-format SHA-256 device certificate thumbprint."""
    return hashlib.sha256(secrets.token_bytes(32)).hexdigest().upper()


def create_access_token(
    *,
    settings: Settings,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    organization_id: uuid.UUID,
    membership_id: uuid.UUID,
    portal_type: str,
) -> tuple[str, int]:
    """
    Create a short-lived signed JWT access token.
    Roles and permission scopes are NEVER trusted from token claims alone;
    the backend resolves live permissions from PostgreSQL on every request.
    """
    now = datetime.now(timezone.utc)
    ttl_seconds = settings.access_token_ttl_minutes * 60
    expires = now + timedelta(seconds=ttl_seconds)

    payload: dict[str, Any] = {
        "typ": "access",
        "jti": str(uuid.uuid4()),
        "sub": str(user_id),
        "sid": str(session_id),
        "org_id": str(organization_id),
        "mem_id": str(membership_id),
        "portal": portal_type,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    return token, ttl_seconds


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    """Verify JWT signature, expiry, and token type."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "sid", "org_id", "mem_id", "portal", "exp", "iat", "typ"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Access token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid authentication token.") from exc

    if payload.get("typ") != "access":
        raise AuthenticationError("Unexpected token type.")
    return payload


def _derive_fernet(settings: Settings) -> Fernet:
    key_material = hashlib.sha256(
        f"scribble-it-mfa-v2:{settings.jwt_secret_key.get_secret_value()}".encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt_mfa_secret(raw_secret: str, settings: Settings) -> str:
    return _derive_fernet(settings).encrypt(raw_secret.encode("utf-8")).decode("utf-8")


def decrypt_mfa_secret(ciphertext: str, settings: Settings) -> str:
    try:
        return _derive_fernet(settings).decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise AuthenticationError("Unable to decrypt MFA credential.") from exc


def generate_totp_secret() -> str:
    """Generate a 160-bit Base32 RFC 6238 TOTP secret."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def generate_totp_code(secret_b32: str, *, for_time: int | None = None, step_seconds: int = 30) -> str:
    """Compute a 6-digit RFC 6238 TOTP code using HMAC-SHA1."""
    padded = secret_b32.upper() + "=" * ((8 - len(secret_b32) % 8) % 8)
    key = base64.b32decode(padded, casefold=True)
    counter = int((for_time if for_time is not None else time.time()) // step_seconds)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code_int:06d}"


def verify_totp_code(secret_b32: str, code: str, *, valid_window: int = 1) -> bool:
    """Verify a 6-digit TOTP code allowing ±1 time step clock drift."""
    clean = code.strip().replace(" ", "")
    if len(clean) != 6 or not clean.isdigit():
        return False
    now = int(time.time())
    for offset in range(-valid_window, valid_window + 1):
        expected = generate_totp_code(secret_b32, for_time=now + offset * 30)
        if hmac.compare_digest(expected, clean):
            return True
    return False


def generate_backup_codes(count: int = 8) -> tuple[list[str], list[str]]:
    """Return (plaintext_codes_shown_once, sha256_hashed_codes_for_db)."""
    plain_codes: list[str] = []
    hashed_codes: list[str] = []
    for _ in range(count):
        part1 = "".join(secrets.choice(_ENROLLMENT_ALPHABET) for _ in range(4))
        part2 = "".join(secrets.choice(_ENROLLMENT_ALPHABET) for _ in range(4))
        raw = f"{part1}-{part2}"
        plain_codes.append(raw)
        hashed_codes.append(hash_token(raw))
    return plain_codes, hashed_codes


async def enforce_rate_limit(
    *,
    bucket: str,
    identifier: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    """
    Brute-force protection using Redis atomic counters with automatic in-memory fallback
    when Redis is unavailable (e.g. isolated unit tests).
    """
    key = f"rl:{bucket}:{identifier.lower()}"
    try:
        client = redis_manager.client
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, window_seconds)
        if current > max_requests:
            raise RateLimitError(
                f"Too many {bucket} attempts. Please retry after {window_seconds} seconds."
            )
        return
    except RateLimitError:
        raise
    except Exception:
        # In-memory sliding window fallback for unit test isolation or transient Redis outage
        now = time.monotonic()
        dq = _LOCAL_RATE_BUCKETS[key]
        cutoff = now - window_seconds
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= max_requests:
            raise RateLimitError(
                f"Too many {bucket} attempts. Please retry after {window_seconds} seconds."
            )
        dq.append(now)


def reset_local_rate_limits() -> None:
    """Test helper to clear in-memory rate limit buckets between test cases."""
    _LOCAL_RATE_BUCKETS.clear()
