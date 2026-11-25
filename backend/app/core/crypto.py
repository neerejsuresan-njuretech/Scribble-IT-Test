from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from typing import Any

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:  # pragma: no cover - stdlib fallback only when cryptography pkg absent
    Fernet = None  # type: ignore[assignment]
    InvalidToken = Exception  # type: ignore[assignment,misc]


class SecretDecryptionError(ValueError):
    """Raised when encrypted integration credentials fail integrity or key verification."""


def _derive_fernet_key(master_secret: str) -> bytes:
    """Derive a deterministic 32-byte URL-safe base64 key from INTEGRATION_ENCRYPTION_KEY."""
    digest = hashlib.sha256(f"scribble-it:fernet:v1:{master_secret}".encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _derive_hmac_stream_keys(master_secret: str) -> tuple[bytes, bytes]:
    enc_key = hashlib.sha256(f"scribble-it:enc:v1:{master_secret}".encode("utf-8")).digest()
    mac_key = hashlib.sha256(f"scribble-it:mac:v1:{master_secret}".encode("utf-8")).digest()
    return enc_key, mac_key


def _xor_keystream(data: bytes, key: bytes, nonce: bytes) -> bytes:
    out = bytearray(len(data))
    offset = 0
    counter = 0
    while offset < len(data):
        block = hmac.new(key, nonce + counter.to_bytes(8, "big"), hashlib.sha256).digest()
        chunk = data[offset : offset + len(block)]
        for i, b in enumerate(chunk):
            out[offset + i] = b ^ block[i]
        offset += len(chunk)
        counter += 1
    return bytes(out)


def encrypt_secret(plaintext: str, master_secret: str) -> str:
    """
    Encrypt a credential string at rest using authenticated encryption.
    Uses `cryptography.fernet.Fernet` (AES-128-CBC + HMAC-SHA256) in production,
    with an authenticated HMAC-SHA256 stream fallback when running stdlib-only tests.
    """
    if not master_secret or len(master_secret) < 16:
        raise ValueError("Master encryption secret must be at least 16 characters.")

    raw = plaintext.encode("utf-8")
    if Fernet is not None:
        token = Fernet(_derive_fernet_key(master_secret)).encrypt(raw).decode("ascii")
        return f"fernet:v1:{token}"

    enc_key, mac_key = _derive_hmac_stream_keys(master_secret)
    nonce = os.urandom(16)
    ciphertext = _xor_keystream(raw, enc_key, nonce)
    tag = hmac.new(mac_key, nonce + ciphertext, hashlib.sha256).digest()
    blob = base64.urlsafe_b64encode(nonce + tag + ciphertext).decode("ascii")
    return f"hmacbox:v1:{blob}"


def decrypt_secret(ciphertext_envelope: str, master_secret: str) -> str:
    """Decrypt and verify integrity of an encrypted credential envelope."""
    if not ciphertext_envelope or ":" not in ciphertext_envelope:
        raise SecretDecryptionError("Malformed secret envelope.")

    if ciphertext_envelope.startswith("fernet:v1:"):
        if Fernet is None:
            raise SecretDecryptionError("cryptography package is required to decrypt fernet:v1 envelopes.")
        token = ciphertext_envelope[len("fernet:v1:") :].encode("ascii")
        try:
            return Fernet(_derive_fernet_key(master_secret)).decrypt(token).decode("utf-8")
        except InvalidToken as exc:
            raise SecretDecryptionError("Credential authentication failed or wrong key.") from exc

    if ciphertext_envelope.startswith("hmacbox:v1:"):
        raw = base64.urlsafe_b64decode(ciphertext_envelope[len("hmacbox:v1:") :].encode("ascii"))
        if len(raw) < 48:
            raise SecretDecryptionError("Truncated ciphertext envelope.")
        nonce = raw[:16]
        expected_tag = raw[16:48]
        ciphertext = raw[48:]
        enc_key, mac_key = _derive_hmac_stream_keys(master_secret)
        actual_tag = hmac.new(mac_key, nonce + ciphertext, hashlib.sha256).digest()
        if not hmac.compare_digest(expected_tag, actual_tag):
            raise SecretDecryptionError("Credential authentication tag mismatch.")
        return _xor_keystream(ciphertext, enc_key, nonce).decode("utf-8")

    raise SecretDecryptionError("Unsupported encryption envelope version.")


def encrypt_json_payload(payload: dict[str, Any], master_secret: str) -> str:
    """Serialize and encrypt a dictionary of integration secrets."""
    serialized = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return encrypt_secret(serialized, master_secret)


def decrypt_json_payload(envelope: str, master_secret: str) -> dict[str, Any]:
    """Decrypt and parse a JSON dictionary of integration secrets."""
    plaintext = decrypt_secret(envelope, master_secret)
    data = json.loads(plaintext)
    if not isinstance(data, dict):
        raise SecretDecryptionError("Decrypted credential payload is not a JSON object.")
    return data


def mask_secret(value: str | None) -> str:
    """Return a safe display mask exposing at most the final 4 characters."""
    if not value:
        return ""
    if len(value) <= 6:
        return "******"
    return f"{'*' * 8}{value[-4:]}"
