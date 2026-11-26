from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt

from app.core.ssrf import APNS_ALLOWED_HOSTS, FCM_ALLOWED_HOSTS, validate_outbound_url

_FCM_OAUTH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_FCM_TOKEN_URI = "https://oauth2.googleapis.com/token"
_FCM_PERMANENT_ERROR_CODES = frozenset({"UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"})
_APNS_PERMANENT_REASONS = frozenset(
    {
        "BadDeviceToken",
        "Unregistered",
        "DeviceTokenNotForTopic",
        "TopicDisallowed",
    }
)


@dataclass(frozen=True)
class PushSendResult:
    """Normalized provider delivery outcome."""

    delivered: bool
    http_status: int
    provider_message_id: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    permanent_token_invalid: bool = False
    retryable: bool = False


def _normalize_pem(raw_pem: str) -> str:
    """Restore escaped newline sequences when PEM keys are supplied via env vars."""
    return (raw_pem or "").replace("\\n", "\n").strip()


def _stringify_data_map(data: dict[str, Any] | None) -> dict[str, str]:
    if not data:
        return {}
    out: dict[str, str] = {}
    for k, v in data.items():
        key = str(k).strip()[:64]
        if not key:
            continue
        out[key] = ("" if v is None else str(v))[:1024]
    return out


class FcmPushAdapter:
    """
    Secure backend-only Firebase Cloud Messaging (FCM) HTTP v1 adapter.
    Signs short-lived RS256 OAuth2 service-account assertions and exchanges them
    strictly against allowlisted Google hosts (`oauth2.googleapis.com`, `fcm.googleapis.com`).
    """

    @staticmethod
    def build_service_account_assertion(
        *,
        client_email: str,
        private_key_pem: str,
        now_ts: int | None = None,
    ) -> str:
        issued_at = int(now_ts if now_ts is not None else time.time())
        claims = {
            "iss": client_email.strip(),
            "sub": client_email.strip(),
            "aud": _FCM_TOKEN_URI,
            "scope": _FCM_OAUTH_SCOPE,
            "iat": issued_at,
            "exp": issued_at + 3600,
        }
        return jwt.encode(claims, _normalize_pem(private_key_pem), algorithm="RS256")

    @staticmethod
    async def fetch_oauth_access_token(
        *,
        client_email: str,
        private_key_pem: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> str:
        validate_outbound_url(_FCM_TOKEN_URI, allowed_hosts=FCM_ALLOWED_HOSTS)
        assertion = FcmPushAdapter.build_service_account_assertion(
            client_email=client_email,
            private_key_pem=private_key_pem,
        )
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False, transport=transport) as client:
            resp = await client.post(
                _FCM_TOKEN_URI,
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                },
            )
            if resp.status_code >= 400:
                raise RuntimeError(f"FCM OAuth token exchange failed with HTTP {resp.status_code}.")
            payload = resp.json()
            token = str(payload.get("access_token") or "").strip()
            if not token:
                raise RuntimeError("FCM OAuth token exchange returned an empty access_token.")
            return token

    @staticmethod
    async def send(
        *,
        project_id: str,
        client_email: str,
        private_key_pem: str,
        device_token: str,
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
        priority: str = "normal",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> PushSendResult:
        clean_project = project_id.strip()
        if not clean_project or "/" in clean_project or ".." in clean_project:
            raise ValueError("Invalid FCM project_id.")
        endpoint = f"https://fcm.googleapis.com/v1/projects/{clean_project}/messages:send"
        validate_outbound_url(endpoint, allowed_hosts=FCM_ALLOWED_HOSTS)

        access_token = await FcmPushAdapter.fetch_oauth_access_token(
            client_email=client_email,
            private_key_pem=private_key_pem,
            transport=transport,
        )

        fcm_payload: dict[str, Any] = {
            "message": {
                "token": device_token,
                "notification": {"title": title[:240], "body": body[:2000]},
                "data": _stringify_data_map(data),
                "android": {"priority": "HIGH" if priority == "high" else "NORMAL"},
            }
        }

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False, transport=transport) as client:
            resp = await client.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=fcm_payload,
            )

        if 200 <= resp.status_code < 300:
            resp_json = resp.json() if resp.content else {}
            return PushSendResult(
                delivered=True,
                http_status=resp.status_code,
                provider_message_id=str(resp_json.get("name") or "") or None,
            )

        error_code = f"FCM_HTTP_{resp.status_code}"
        error_msg = resp.text[:400]
        try:
            err_body = resp.json().get("error", {})
            if isinstance(err_body, dict):
                error_msg = str(err_body.get("message") or error_msg)[:400]
                details = err_body.get("details") or []
                fcm_detail_code = None
                if isinstance(details, list):
                    for item in details:
                        if isinstance(item, dict) and item.get("errorCode"):
                            fcm_detail_code = str(item["errorCode"])
                            break
                error_code = fcm_detail_code or str(err_body.get("status") or error_code)
        except Exception:
            pass

        permanent = error_code in _FCM_PERMANENT_ERROR_CODES or resp.status_code == 404
        retryable = (not permanent) and (resp.status_code == 429 or resp.status_code >= 500)
        return PushSendResult(
            delivered=False,
            http_status=resp.status_code,
            error_code=error_code[:96],
            error_message=error_msg[:512],
            permanent_token_invalid=permanent,
            retryable=retryable,
        )


class ApnsPushAdapter:
    """
    Secure backend-only Apple Push Notification service (APNs) adapter.
    Signs ES256 provider JWT tokens with the `.p8` Auth Key and posts strictly
    to allowlisted Apple endpoints (`api.push.apple.com` or `api.sandbox.push.apple.com`).
    """

    @staticmethod
    def build_provider_jwt(
        *,
        team_id: str,
        key_id: str,
        private_key_pem: str,
        now_ts: int | None = None,
    ) -> str:
        issued_at = int(now_ts if now_ts is not None else time.time())
        headers = {"alg": "ES256", "kid": key_id.strip()}
        claims = {"iss": team_id.strip(), "iat": issued_at}
        return jwt.encode(
            claims,
            _normalize_pem(private_key_pem),
            algorithm="ES256",
            headers=headers,
        )

    @staticmethod
    async def send(
        *,
        team_id: str,
        key_id: str,
        bundle_id: str,
        private_key_pem: str,
        device_token: str,
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
        priority: str = "normal",
        use_sandbox: bool = False,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> PushSendResult:
        clean_token = device_token.strip()
        if not clean_token or "/" in clean_token or ".." in clean_token:
            raise ValueError("Invalid APNs device token.")

        host = "api.sandbox.push.apple.com" if use_sandbox else "api.push.apple.com"
        endpoint = f"https://{host}/3/device/{clean_token}"
        validate_outbound_url(endpoint, allowed_hosts=APNS_ALLOWED_HOSTS)

        auth_jwt = ApnsPushAdapter.build_provider_jwt(
            team_id=team_id,
            key_id=key_id,
            private_key_pem=private_key_pem,
        )

        apns_body: dict[str, Any] = {
            "aps": {
                "alert": {"title": title[:240], "body": body[:2000]},
                "sound": "default",
            }
        }
        if data:
            for k, v in data.items():
                key = str(k).strip()[:64]
                if key and key != "aps":
                    apns_body[key] = v

        headers = {
            "authorization": f"bearer {auth_jwt}",
            "apns-topic": bundle_id.strip(),
            "apns-push-type": "alert",
            "apns-priority": "10" if priority == "high" else "5",
            "content-type": "application/json",
        }

        client_kwargs: dict[str, Any] = {"timeout": 15.0, "follow_redirects": False}
        if transport is not None:
            client_kwargs["transport"] = transport
        else:
            # APNs requires HTTP/2 in live production traffic when h2 is installed
            try:
                import h2  # noqa: F401

                client_kwargs["http2"] = True
            except ImportError:
                pass

        async with httpx.AsyncClient(**client_kwargs) as client:
            resp = await client.post(endpoint, headers=headers, json=apns_body)

        apns_id = resp.headers.get("apns-id")
        if 200 <= resp.status_code < 300:
            return PushSendResult(
                delivered=True,
                http_status=resp.status_code,
                provider_message_id=apns_id,
            )

        reason = f"APNS_HTTP_{resp.status_code}"
        error_msg = resp.text[:400]
        try:
            err_json = resp.json()
            if isinstance(err_json, dict) and err_json.get("reason"):
                reason = str(err_json["reason"])
                error_msg = reason
        except Exception:
            pass

        permanent = reason in _APNS_PERMANENT_REASONS or resp.status_code == 410
        retryable = (not permanent) and (resp.status_code == 429 or resp.status_code >= 500)
        return PushSendResult(
            delivered=False,
            http_status=resp.status_code,
            provider_message_id=apns_id,
            error_code=reason[:96],
            error_message=error_msg[:512],
            permanent_token_invalid=permanent,
            retryable=retryable,
        )
