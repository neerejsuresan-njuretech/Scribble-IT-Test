from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.exceptions import AppError, ValidationDomainError
from app.core.ssrf import (
    GOOGLE_WORKSPACE_ALLOWED_HOSTS,
    TWILIO_ALLOWED_HOSTS,
    validate_outbound_url,
)
from app.modules.integrations.signatures import sign_outbound_webhook


class GoogleWorkspaceAdapter:
    """Backend adapter for Google Drive, Sheets, Forms, and Chat with OAuth refresh and host allowlisting."""

    TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

    @staticmethod
    async def refresh_access_token(
        *,
        client_id: str,
        client_secret: str,
        refresh_token: str,
    ) -> tuple[str, datetime]:
        validate_outbound_url(GoogleWorkspaceAdapter.TOKEN_ENDPOINT, allowed_hosts=GOOGLE_WORKSPACE_ALLOWED_HOSTS)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                GoogleWorkspaceAdapter.TOKEN_ENDPOINT,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            if resp.status_code >= 400:
                raise AppError(
                    status_code=502,
                    error_code="GOOGLE_OAUTH_REFRESH_FAILED",
                    message=f"Google OAuth token refresh failed with HTTP {resp.status_code}.",
                )
            data = resp.json()
            token = str(data.get("access_token", "")).strip()
            expires_in = int(data.get("expires_in", 3600))
            if not token:
                raise AppError(
                    status_code=502,
                    error_code="GOOGLE_OAUTH_REFRESH_FAILED",
                    message="Google OAuth refresh returned an empty access token.",
                )
            return token, datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    @staticmethod
    async def execute_action(
        *,
        access_token: str,
        action: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        method = "GET"
        url = ""
        body: dict[str, Any] | None = None

        if action == "drive_list_files":
            page_size = max(1, min(50, int(params.get("page_size", 15))))
            url = (
                f"https://www.googleapis.com/drive/v3/files?pageSize={page_size}"
                "&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&orderBy=modifiedTime%20desc"
            )
        elif action == "drive_upload_text":
            name = str(params.get("name", "scribble-export.txt"))[:160]
            content = str(params.get("content", ""))
            url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=media&fields=id,name,webViewLink"
            validate_outbound_url(url, allowed_hosts=GOOGLE_WORKSPACE_ALLOWED_HOSTS)
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    url,
                    headers={"Authorization": f"Bearer {access_token}", "Content-Type": "text/plain"},
                    content=content.encode("utf-8"),
                )
                if resp.status_code >= 400:
                    raise AppError(status_code=502, error_code="GOOGLE_API_ERROR", message=f"Drive upload failed ({resp.status_code}).")
                return {"file": resp.json(), "requested_name": name}
        elif action == "sheets_create":
            method = "POST"
            url = "https://sheets.googleapis.com/v4/spreadsheets"
            body = {"properties": {"title": str(params.get("title", "Scribble-IT Export"))[:200]}}
        elif action == "sheets_append":
            spreadsheet_id = str(params.get("spreadsheet_id", "")).strip()
            sheet_range = str(params.get("range", "Sheet1!A1")).strip()
            rows = params.get("values", [])
            if not spreadsheet_id or "/" in spreadsheet_id or ".." in spreadsheet_id:
                raise ValidationDomainError("Invalid spreadsheet_id.")
            method = "POST"
            url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{sheet_range}:append?valueInputOption=USER_ENTERED"
            body = {"values": rows if isinstance(rows, list) else []}
        elif action == "forms_list":
            url = (
                "https://www.googleapis.com/drive/v3/files"
                "?q=mimeType='application/vnd.google-apps.form'&fields=files(id,name,webViewLink,modifiedTime)&pageSize=15"
            )
        elif action == "forms_create":
            title = str(params.get("title", "IT Intake Form"))[:200]
            method = "POST"
            url = "https://forms.googleapis.com/v1/forms"
            body = {"info": {"title": title, "documentTitle": title}}
        elif action == "chat_list_spaces":
            url = "https://chat.googleapis.com/v1/spaces"
        elif action == "chat_send_message":
            space_name = str(params.get("space_name", "")).strip()
            text = str(params.get("text", "")).strip()
            if not space_name.startswith("spaces/") or ".." in space_name:
                raise ValidationDomainError("Invalid Google Chat space_name.")
            method = "POST"
            url = f"https://chat.googleapis.com/v1/{space_name}/messages"
            body = {"text": text[:4000]}
        else:
            raise ValidationDomainError(f"Unsupported Google Workspace action '{action}'.")

        validate_outbound_url(url, allowed_hosts=GOOGLE_WORKSPACE_ALLOWED_HOSTS)
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.request(method, url, headers=headers, json=body)
            if resp.status_code >= 400:
                raise AppError(
                    status_code=502,
                    error_code="GOOGLE_API_ERROR",
                    message=f"Google Workspace API returned HTTP {resp.status_code}.",
                )
            return resp.json()


class TwilioTelephonyAdapter:
    """Backend Twilio REST adapter with host allowlisting and basic auth."""

    @staticmethod
    async def initiate_outbound_call(
        *,
        account_sid: str,
        auth_token: str,
        from_number: str,
        to_number: str,
        twiml_url: str | None = None,
    ) -> dict[str, Any]:
        if not account_sid or not auth_token or not from_number:
            raise AppError(
                status_code=503,
                error_code="TELEPHONY_NOT_CONFIGURED",
                message="Twilio credentials are not configured for this organization or server.",
            )
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"
        validate_outbound_url(url, allowed_hosts=TWILIO_ALLOWED_HOSTS)
        form = {
            "From": from_number,
            "To": to_number,
            "Twiml": "<Response><Say>Scribble IT Service Desk connecting your call.</Say></Response>",
        }
        if twiml_url:
            validate_outbound_url(twiml_url)
            form.pop("Twiml", None)
            form["Url"] = twiml_url

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, data=form, auth=(account_sid, auth_token))
            if resp.status_code >= 400:
                raise AppError(
                    status_code=502,
                    error_code="TWILIO_API_ERROR",
                    message=f"Twilio call creation failed with HTTP {resp.status_code}.",
                )
            return resp.json()


class WebhookDeliveryAdapter:
    """SSRF-protected outbound webhook delivery adapter with HMAC-SHA256 signing."""

    @staticmethod
    async def deliver(
        *,
        target_url: str,
        signing_secret: str,
        event_type: str,
        payload: dict[str, Any],
        allow_http_in_test: bool = False,
    ) -> tuple[int, str]:
        safe_url = validate_outbound_url(target_url, allow_http_in_test=allow_http_in_test)
        ts = int(time.time())
        body_bytes = json.dumps(
            {"event": event_type, "timestamp": ts, "data": payload},
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        sig = sign_outbound_webhook(secret=signing_secret, timestamp=ts, payload_bytes=body_bytes)

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            resp = await client.post(
                safe_url,
                content=body_bytes,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Scribble-IT-Webhook/2.0",
                    "X-Scribble-Event": event_type,
                    "X-Scribble-Timestamp": str(ts),
                    "X-Scribble-Signature-256": sig,
                },
            )
            return resp.status_code, resp.text[:500]
