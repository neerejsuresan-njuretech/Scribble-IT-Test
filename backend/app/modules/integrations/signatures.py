from __future__ import annotations

import base64
import hashlib
import hmac
import time
from collections.abc import Mapping


def sign_outbound_webhook(*, secret: str, timestamp: int, payload_bytes: bytes) -> str:
    """Compute Scribble-IT outbound webhook signature: sha256=<hmac(secret, f'{ts}.{body}')>."""
    signed_input = f"{timestamp}.".encode("ascii") + payload_bytes
    digest = hmac.new(secret.encode("utf-8"), signed_input, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_inbound_webhook(
    *,
    secret: str,
    timestamp_header: str | None,
    signature_header: str | None,
    payload_bytes: bytes,
    replay_window_seconds: int = 300,
    now_epoch: int | None = None,
) -> tuple[bool, str]:
    """Verify HMAC-SHA256 webhook signature and reject replayed/expired timestamps."""
    if not secret:
        return False, "Webhook signing secret is not configured."
    if not timestamp_header or not signature_header:
        return False, "Missing X-Scribble-Timestamp or X-Scribble-Signature-256 header."

    try:
        ts = int(timestamp_header.strip())
    except ValueError:
        return False, "Invalid webhook timestamp format."

    current = int(now_epoch if now_epoch is not None else time.time())
    if abs(current - ts) > replay_window_seconds:
        return False, "Webhook timestamp is outside the permitted replay window."

    expected = sign_outbound_webhook(secret=secret, timestamp=ts, payload_bytes=payload_bytes)
    if not hmac.compare_digest(expected, signature_header.strip()):
        return False, "Webhook HMAC signature mismatch."

    return True, "ok"


def compute_twilio_signature(*, auth_token: str, full_url: str, form_params: Mapping[str, str]) -> str:
    """Compute canonical Twilio X-Twilio-Signature (Base64 HMAC-SHA1 over URL + sorted params)."""
    data = full_url
    for key in sorted(form_params.keys()):
        data += f"{key}{form_params[key]}"
    mac = hmac.new(auth_token.encode("utf-8"), data.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(mac).decode("ascii")


def verify_twilio_signature(
    *,
    auth_token: str,
    full_url: str,
    form_params: Mapping[str, str],
    signature_header: str | None,
) -> bool:
    """Constant-time verification of Twilio webhook X-Twilio-Signature."""
    if not auth_token or not signature_header:
        return False
    expected = compute_twilio_signature(
        auth_token=auth_token,
        full_url=full_url,
        form_params=form_params,
    )
    return hmac.compare_digest(expected, signature_header.strip())
