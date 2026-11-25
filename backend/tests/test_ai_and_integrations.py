from __future__ import annotations

import os
import time

import pytest

from app.core.crypto import decrypt_json_payload, decrypt_secret, encrypt_json_payload, encrypt_secret, mask_secret
from app.core.ssrf import GOOGLE_WORKSPACE_ALLOWED_HOSTS, SsrfBlockedError, validate_outbound_url
from app.modules.ai.guardrails import (
    AiGovernanceViolationError,
    FORBIDDEN_AI_AUTONOMOUS_ACTIONS,
    assert_human_governance_boundary,
    validate_change_assess_output,
    validate_draft_kb_output,
    validate_incident_triage_output,
    validate_triage_assistant_output,
)
from app.modules.integrations.signatures import (
    compute_twilio_signature,
    sign_outbound_webhook,
    verify_inbound_webhook,
    verify_twilio_signature,
)
from app.workers.runner import compute_backoff_seconds

MASTER_KEY = "test-master-integration-encryption-key-32bytes"


def test_ai_governance_boundary_blocks_all_privileged_actions() -> None:
    for forbidden in FORBIDDEN_AI_AUTONOMOUS_ACTIONS:
        with pytest.raises(AiGovernanceViolationError):
            assert_human_governance_boundary(forbidden)
    # Advisory action succeeds
    assert_human_governance_boundary("triage_incident")


def test_ai_output_validators_sanitize_and_constrain_enums() -> None:
    triaged = validate_incident_triage_output(
        {
            "recommendedPriority": "INVALID_PRIORITY",
            "recommendedCategory": "Security",
            "suggestedQueue": "SecOps\x00Queue",
            "rootCauseHypothesis": "Expired TLS cert",
            "diagnosticSteps": ["Check ingress", "Inspect cert-manager"],
            "draftResolutionNote": "Renewed cert",
            "draftCustomerReply": "Service restored",
        }
    )
    assert triaged["recommendedPriority"] == "P3"
    assert "\x00" not in triaged["suggestedQueue"]

    assessed = validate_change_assess_output(
        {
            "assessedRisk": "Extreme",
            "readinessScore": 999,
            "riskFindings": ["No canary rollout"],
            "missingControls": ["Backout validation"],
            "recommendedCabGuidance": "Hold for peer review",
        }
    )
    assert assessed["assessedRisk"] == "medium"
    assert assessed["readinessScore"] == 100

    kb_draft = validate_draft_kb_output({}, fallback_topic="VPN Reset", fallback_category="Network")
    assert kb_draft["title"] == "VPN Reset"
    assert kb_draft["category"] == "Network"

    assistant = validate_triage_assistant_output(
        {
            "urgencySignal": "critical",
            "matchedKbArticles": [
                {"kbId": "KB-101", "title": "Spoofed", "relevanceReason": "Exact match", "matchConfidence": "high"},
                {"kbId": "KB-FABRICATED", "title": "Fake", "relevanceReason": "Hallucinated", "matchConfidence": "high"},
            ],
        },
        allowed_kb_ids={"KB-101"},
        kb_titles_by_id={"KB-101": "Real Runbook Title"},
        fallback_title="VPN Down",
        fallback_category="Network",
    )
    assert len(assistant["matchedKbArticles"]) == 1
    assert assistant["matchedKbArticles"][0]["title"] == "Real Runbook Title"


def test_encrypted_credentials_round_trip_and_tamper_rejection() -> None:
    token = encrypt_secret("oauth-secret-value-123", MASTER_KEY)
    assert "oauth-secret-value-123" not in token
    assert decrypt_secret(token, MASTER_KEY) == "oauth-secret-value-123"

    tampered = token[:-4] + "AAAA"
    with pytest.raises(ValueError):
        decrypt_secret(tampered, MASTER_KEY)

    with pytest.raises(ValueError):
        decrypt_secret(token, "wrong-master-key-definitely-different-32chars")

    enc_json = encrypt_json_payload({"client_id": "abc", "client_secret": "xyz"}, MASTER_KEY)
    assert decrypt_json_payload(enc_json, MASTER_KEY) == {"client_id": "abc", "client_secret": "xyz"}
    assert mask_secret("sk_live_1234567890") == "********7890"


def test_webhook_and_twilio_signatures_verify_and_block_replay() -> None:
    secret = "webhook-signing-secret-0123456789"
    payload = b'{"event":"incident.created","id":"INC-1"}'
    now_ts = int(time.time())
    sig = sign_outbound_webhook(secret=secret, timestamp=now_ts, payload_bytes=payload)

    ok, _ = verify_inbound_webhook(
        secret=secret,
        timestamp_header=str(now_ts),
        signature_header=sig,
        payload_bytes=payload,
        replay_window_seconds=300,
    )
    assert ok is True

    # Tampered payload fails
    ok_tampered, _ = verify_inbound_webhook(
        secret=secret,
        timestamp_header=str(now_ts),
        signature_header=sig,
        payload_bytes=b'{"event":"incident.created","id":"INC-2"}',
        replay_window_seconds=300,
    )
    assert ok_tampered is False

    # Expired timestamp fails (replay attack)
    stale_ts = now_ts - 900
    stale_sig = sign_outbound_webhook(secret=secret, timestamp=stale_ts, payload_bytes=payload)
    ok_stale, _ = verify_inbound_webhook(
        secret=secret,
        timestamp_header=str(stale_ts),
        signature_header=stale_sig,
        payload_bytes=payload,
        replay_window_seconds=300,
    )
    assert ok_stale is False

    # Twilio HMAC-SHA1 verification
    tw_url = "https://itsm.example.com/api/v1/integrations/telephony/webhooks/twilio/acme"
    tw_params = {"CallSid": "CA12345", "From": "+15550001111", "To": "+15550002222"}
    tw_token = "twilio_auth_token_secret"
    expected_tw_sig = compute_twilio_signature(
        auth_token=tw_token,
        full_url=tw_url,
        form_params=tw_params,
    )
    assert verify_twilio_signature(
        auth_token=tw_token,
        full_url=tw_url,
        form_params=tw_params,
        signature_header=expected_tw_sig,
    )
    assert not verify_twilio_signature(
        auth_token=tw_token,
        full_url=tw_url,
        form_params={**tw_params, "CallSid": "CA99999"},
        signature_header=expected_tw_sig,
    )


def test_ssrf_allowlist_and_worker_backoff() -> None:
    assert validate_outbound_url(
        "https://www.googleapis.com/drive/v3/files",
        allowed_hosts=GOOGLE_WORKSPACE_ALLOWED_HOSTS,
    ).startswith("https://www.googleapis.com")

    with pytest.raises(SsrfBlockedError):
        validate_outbound_url(
            "https://evil.example.com/drive/v3/files",
            allowed_hosts=GOOGLE_WORKSPACE_ALLOWED_HOSTS,
        )

    assert compute_backoff_seconds(1) == 15
    assert compute_backoff_seconds(2) == 30
    assert compute_backoff_seconds(3) == 60
    assert compute_backoff_seconds(20) == 3600


@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("RUN_LIVE_INTEGRATION_TESTS") != "true",
    reason="Requires live PostgreSQL + Redis (RUN_LIVE_INTEGRATION_TESTS=true)",
)
@pytest.mark.asyncio
async def test_live_ai_and_integrations_require_authentication(test_settings) -> None:
    from httpx import ASGITransport, AsyncClient
    from app.main import create_app

    app = create_app(settings_override=test_settings)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            r_ai = await client.post("/api/v1/ai/triage-incident", json={"title": "Test", "description": "Test"})
            assert r_ai.status_code == 401
            r_int = await client.get("/api/v1/integrations/connections")
            assert r_int.status_code == 401
            r_wh = await client.get("/api/v1/integrations/webhooks")
            assert r_wh.status_code == 401
