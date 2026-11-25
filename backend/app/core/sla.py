from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# Standard ITIL Impact x Urgency -> Priority Matrix
PRIORITY_MATRIX: dict[tuple[str, str], str] = {
    ("high", "high"): "P1",
    ("high", "medium"): "P2",
    ("high", "low"): "P3",
    ("medium", "high"): "P2",
    ("medium", "medium"): "P3",
    ("medium", "low"): "P3",
    ("low", "high"): "P3",
    ("low", "medium"): "P4",
    ("low", "low"): "P4",
}

DEFAULT_SLA_HOURS: dict[str, int] = {
    "P1": 4,
    "P2": 8,
    "P3": 24,
    "P4": 72,
}

DEFAULT_RESPONSE_MINUTES: dict[str, int] = {
    "P1": 15,
    "P2": 60,
    "P3": 240,
    "P4": 480,
}


@dataclass(frozen=True)
class SlaStatusSnapshot:
    priority: str
    deadline: datetime
    breached: bool
    paused: bool
    remaining_minutes: int
    percent_elapsed: float


def calculate_priority(impact: str, urgency: str) -> str:
    """Compute ITIL priority from impact and urgency."""
    return PRIORITY_MATRIX.get((impact.lower(), urgency.lower()), "P3")


def resolve_sla_hours(
    priority: str,
    *,
    org_sla_targets: dict[str, int] | None = None,
    override_hours: int | None = None,
    policy_resolution_mins: int | None = None,
) -> float:
    """Resolve effective SLA resolution window in hours."""
    if override_hours is not None and override_hours > 0:
        return float(override_hours)
    if policy_resolution_mins is not None and policy_resolution_mins > 0:
        return float(policy_resolution_mins) / 60.0
    if org_sla_targets and priority in org_sla_targets:
        val = int(org_sla_targets[priority])
        if val > 0:
            return float(val)
    return float(DEFAULT_SLA_HOURS.get(priority, 24))


def compute_sla_deadline(
    *,
    created_at: datetime,
    priority: str,
    org_sla_targets: dict[str, int] | None = None,
    override_hours: int | None = None,
    policy_resolution_mins: int | None = None,
) -> datetime:
    """Compute UTC SLA resolution deadline."""
    base = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    hours = resolve_sla_hours(
        priority,
        org_sla_targets=org_sla_targets,
        override_hours=override_hours,
        policy_resolution_mins=policy_resolution_mins,
    )
    return base + timedelta(hours=hours)


def evaluate_sla_status(
    *,
    created_at: datetime,
    deadline: datetime,
    priority: str,
    status: str,
    resolved_at: datetime | None = None,
    sla_paused_at: datetime | None = None,
    now: datetime | None = None,
) -> SlaStatusSnapshot:
    """Evaluate real-time SLA breach state, pause status, remaining minutes, and elapsed percentage."""
    ref_now = now or datetime.now(timezone.utc)
    created_utc = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    deadline_utc = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)

    if status in {"resolved", "closed"} and resolved_at is not None:
        effective_now = resolved_at if resolved_at.tzinfo else resolved_at.replace(tzinfo=timezone.utc)
    elif status == "pending" and sla_paused_at is not None:
        effective_now = sla_paused_at if sla_paused_at.tzinfo else sla_paused_at.replace(tzinfo=timezone.utc)
    else:
        effective_now = ref_now

    total_secs = max(1.0, (deadline_utc - created_utc).total_seconds())
    elapsed_secs = max(0.0, (effective_now - created_utc).total_seconds())
    remaining_secs = (deadline_utc - effective_now).total_seconds()

    breached = effective_now > deadline_utc
    paused = status == "pending" and sla_paused_at is not None
    pct = min(100.0, round((elapsed_secs / total_secs) * 100.0, 2))

    return SlaStatusSnapshot(
        priority=priority,
        deadline=deadline_utc,
        breached=breached,
        paused=paused,
        remaining_minutes=int(remaining_secs // 60),
        percent_elapsed=pct,
    )
