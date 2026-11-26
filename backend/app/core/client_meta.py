from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import Request

from app.core.config import Settings
from app.core.exceptions import AppError, ValidationDomainError

VALID_CLIENT_TYPES = frozenset({"web", "desktop", "mobile"})
VALID_CLIENT_PLATFORMS = frozenset({"web", "windows", "macos", "linux", "android", "ios"})
PLATFORMS_BY_CLIENT_TYPE: dict[str, frozenset[str]] = {
    "web": frozenset({"web"}),
    "desktop": frozenset({"windows", "macos", "linux"}),
    "mobile": frozenset({"android", "ios"}),
}

_SEMVER_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][A-Za-z0-9._-]+)?$")
_APP_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+$")


@dataclass(frozen=True)
class ValidatedClientMetadata:
    client_type: str = "web"
    client_platform: str = "web"
    app_version: str | None = None
    app_id: str | None = None
    device_name: str | None = None
    os_version: str | None = None
    device_model: str | None = None


def parse_semver_core(version: str) -> tuple[int, int, int]:
    cleaned = (version or "").strip()
    match = _SEMVER_RE.fullmatch(cleaned)
    if not match:
        raise ValidationDomainError(
            f"Invalid application version '{cleaned}'. Expected semantic version (e.g. 2.1.0)."
        )
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def resolve_client_metadata(
    *,
    request: Request | None = None,
    settings: Settings | None = None,
    body_client_type: str | None = None,
    body_client_platform: str | None = None,
    body_app_version: str | None = None,
    body_app_id: str | None = None,
    body_device_name: str | None = None,
    body_os_version: str | None = None,
    body_device_model: str | None = None,
) -> ValidatedClientMetadata:
    """
    Validates and normalizes client application metadata from headers and/or request body.
    Headers supported:
      - X-Scribble-Client-Type: web | desktop | mobile
      - X-Scribble-Client-Platform: web | windows | macos | linux | android | ios
      - X-Scribble-App-Version: semantic version (required when native metadata is declared)
      - X-Scribble-App-Id: reverse-DNS bundle/package identifier
      - X-Scribble-Device-Name: sanitized host/device label
    Never trusts client metadata for authorization, roles, or organization permissions.
    """
    hdr_type = request.headers.get("X-Scribble-Client-Type", "").strip().lower() if request else ""
    hdr_platform = (
        request.headers.get("X-Scribble-Client-Platform", "").strip().lower() if request else ""
    )
    hdr_version = request.headers.get("X-Scribble-App-Version", "").strip() if request else ""
    hdr_app_id = request.headers.get("X-Scribble-App-Id", "").strip() if request else ""
    hdr_device_name = request.headers.get("X-Scribble-Device-Name", "").strip() if request else ""

    norm_body_type = body_client_type.strip().lower() if body_client_type else ""
    norm_body_platform = body_client_platform.strip().lower() if body_client_platform else ""
    norm_body_version = body_app_version.strip() if body_app_version else ""
    norm_body_app_id = body_app_id.strip() if body_app_id else ""
    norm_body_device_name = body_device_name.strip() if body_device_name else ""

    if hdr_type and norm_body_type and hdr_type != norm_body_type:
        raise ValidationDomainError(
            "Conflicting client_type between X-Scribble-Client-Type header and request body."
        )
    if hdr_platform and norm_body_platform and hdr_platform != norm_body_platform:
        raise ValidationDomainError(
            "Conflicting client_platform between X-Scribble-Client-Platform header and request body."
        )

    raw_platform = norm_body_platform or hdr_platform
    raw_type = norm_body_type or hdr_type

    if not raw_type and raw_platform:
        if raw_platform in PLATFORMS_BY_CLIENT_TYPE["desktop"]:
            raw_type = "desktop"
        elif raw_platform in PLATFORMS_BY_CLIENT_TYPE["mobile"]:
            raw_type = "mobile"
        elif raw_platform == "web":
            raw_type = "web"

    client_type = raw_type or "web"
    if client_type not in VALID_CLIENT_TYPES:
        raise ValidationDomainError(f"Unsupported client_type '{client_type}'.")

    if raw_platform:
        client_platform = raw_platform
    elif client_type == "web":
        client_platform = "web"
    else:
        raise ValidationDomainError(
            f"Native client_type '{client_type}' must declare a valid client_platform."
        )

    if client_platform not in VALID_CLIENT_PLATFORMS:
        raise ValidationDomainError(f"Unsupported client_platform '{client_platform}'.")

    allowed_platforms = PLATFORMS_BY_CLIENT_TYPE[client_type]
    if client_platform not in allowed_platforms:
        raise ValidationDomainError(
            f"Platform '{client_platform}' is incompatible with client_type '{client_type}'."
        )

    app_version = norm_body_version or hdr_version or None
    app_id = norm_body_app_id or hdr_app_id or None
    device_name = (norm_body_device_name or hdr_device_name or "")[:160] or None
    os_version = (body_os_version.strip() if body_os_version else "")[:64] or None
    device_model = (body_device_model.strip() if body_device_model else "")[:128] or None

    if client_type in {"desktop", "mobile"}:
        if not app_version:
            raise ValidationDomainError(
                f"Native '{client_type}' clients must supply a valid semantic app_version."
            )
        parsed_version = parse_semver_core(app_version)
        if settings is not None:
            min_ver_str = (
                settings.min_desktop_app_version
                if client_type == "desktop"
                else settings.min_mobile_app_version
            )
            min_ver = parse_semver_core(min_ver_str)
            if parsed_version < min_ver:
                raise AppError(
                    status_code=426,
                    error_code="CLIENT_UPGRADE_REQUIRED",
                    message=(
                        f"Client version {app_version} is below the minimum supported "
                        f"{client_type} version ({min_ver_str}). Please upgrade."
                    ),
                )
    elif app_version:
        parse_semver_core(app_version)

    if app_id:
        if len(app_id) > 160 or not _APP_ID_RE.fullmatch(app_id):
            raise ValidationDomainError(
                "Invalid app_id format. Expected reverse-DNS identifier (e.g. com.njuretech.scribbleit)."
            )
        if settings is not None and settings.allowed_native_app_ids:
            if app_id not in settings.allowed_native_app_ids:
                raise ValidationDomainError(
                    f"Application identifier '{app_id}' is not authorized by server policy."
                )

    return ValidatedClientMetadata(
        client_type=client_type,
        client_platform=client_platform,
        app_version=app_version,
        app_id=app_id,
        device_name=device_name,
        os_version=os_version,
        device_model=device_model,
    )
