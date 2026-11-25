from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

BLOCKED_HOSTNAMES = frozenset(
    {
        "localhost",
        "localhost.localdomain",
        "ip6-localhost",
        "ip6-loopback",
        "metadata.google.internal",
        "metadata",
        "instance-data",
        "kubernetes.default.svc",
    }
)

GOOGLE_WORKSPACE_ALLOWED_HOSTS = frozenset(
    {
        "www.googleapis.com",
        "forms.googleapis.com",
        "chat.googleapis.com",
        "sheets.googleapis.com",
        "oauth2.googleapis.com",
        "drive.googleapis.com",
    }
)

TWILIO_ALLOWED_HOSTS = frozenset(
    {
        "api.twilio.com",
    }
)


class SsrfBlockedError(ValueError):
    """Raised when an outbound URL violates SSRF or host-allowlist security rules."""


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    # Unwrap IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        addr = addr.ipv4_mapped

    return bool(
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def validate_outbound_url(
    url: str,
    *,
    allowed_hosts: frozenset[str] | None = None,
    allow_http_in_test: bool = False,
    resolve_dns: bool = False,
) -> str:
    """
    Strictly validate an outbound webhook or external integration URL against SSRF.
    Blocks non-HTTPS schemes, embedded credentials, loopback, private networks,
    link-local/cloud metadata IPs, and non-allowlisted hosts when an allowlist is supplied.
    """
    cleaned = (url or "").strip()
    if not cleaned or len(cleaned) > 2048:
        raise SsrfBlockedError("Outbound URL must be between 1 and 2048 characters.")

    parsed = urlparse(cleaned)
    allowed_schemes = {"https", "http"} if allow_http_in_test else {"https"}
    if parsed.scheme.lower() not in allowed_schemes:
        raise SsrfBlockedError(f"Outbound URL scheme '{parsed.scheme}' is not permitted; use HTTPS.")

    if parsed.username or parsed.password:
        raise SsrfBlockedError("Embedded credentials in outbound URLs are forbidden.")

    hostname = (parsed.hostname or "").strip().lower().rstrip(".")
    if not hostname:
        raise SsrfBlockedError("Outbound URL must specify a valid hostname.")

    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise SsrfBlockedError(f"Outbound destination '{hostname}' is blocked by network policy.")

    if _is_blocked_ip(hostname):
        raise SsrfBlockedError(f"Outbound IP address '{hostname}' targets a private or reserved range.")

    # Reject integer/hex/octal encoded IP literals like http://2130706433/ or 0x7f000001
    if hostname.isdigit() or hostname.startswith("0x"):
        raise SsrfBlockedError("Numeric or hexadecimal IP host literals are forbidden.")

    if allowed_hosts is not None and hostname not in allowed_hosts:
        raise SsrfBlockedError(f"Host '{hostname}' is not in the permitted provider host allowlist.")

    if resolve_dns:
        try:
            infos = socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        except OSError as exc:
            raise SsrfBlockedError(f"Unable to resolve outbound host '{hostname}'.") from exc
        for info in infos:
            resolved_ip = info[4][0]
            if _is_blocked_ip(resolved_ip):
                raise SsrfBlockedError(
                    f"Resolved address for '{hostname}' points to a blocked private/internal IP."
                )

    return cleaned
