from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import PageMeta
from app.core.permissions import PORTAL_END_USER
from app.core.sla import calculate_priority, compute_sla_deadline, evaluate_sla_status
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.identity import OrganizationMembership
from app.db.models.itsm import Incident, IncidentActivity, IncidentAttachment, IncidentRelation
from app.db.models.operations import Notification, SlaPolicy, TicketWorkflowRule
from app.db.models.organizations import Organization
from app.db.session import set_transaction_tenant_context
from app.modules.audit.service import AuditService
from app.modules.incidents.repository import IncidentRepository
from app.modules.incidents.schemas import (
    IncidentActivityCreateRequest,
    IncidentAssignRequest,
    IncidentAttachmentCreateRequest,
    IncidentCloseRequest,
    IncidentCreateRequest,
    IncidentRelationCreateRequest,
    IncidentResolveRequest,
    IncidentUpdateRequest,
)


class IncidentService:
    """Tenant-scoped Incident Management service with SLA calculation and full activity/audit trail."""

    @staticmethod
    async def _resolve_assignee(
        db: AsyncSession,
        *,
        organization_id: uuid.UUID,
        assignee_user_id: uuid.UUID | None,
        fallback_name: str | None = None,
    ) -> tuple[uuid.UUID | None, str]:
        if assignee_user_id is None:
            return None, (fallback_name.strip() if fallback_name else "Unassigned")
        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == organization_id,
                    OrganizationMembership.user_id == assignee_user_id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if membership is None or membership.user is None:
            raise NotFoundError("Assignee does not hold an active membership in this organization.")
        return membership.user.id, membership.user.full_name

    @staticmethod
    async def list_incidents(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        status: str | None = None,
        priority: str | None = None,
        category: str | None = None,
        assignee_user_id: uuid.UUID | None = None,
        sla_breached: bool | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[Incident], PageMeta]:
        await set_transaction_tenant_context(db, principal.organization_id)
        requester_only = principal.user_id if principal.portal_type == PORTAL_END_USER else None
        rows, meta = await IncidentRepository.list_paginated(
            db,
            organization_id=principal.organization_id,
            requester_only_user_id=requester_only,
            status=status,
            priority=priority,
            category=category,
            assignee_user_id=assignee_user_id,
            sla_breached=sla_breached,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )
        now = datetime.now(timezone.utc)
        for row in rows:
            snap = evaluate_sla_status(
                created_at=row.created_at,
                deadline=row.sla_deadline,
                priority=row.priority,
                status=row.status,
                resolved_at=row.resolved_at,
                sla_paused_at=row.sla_paused_at,
                now=now,
            )
            if row.sla_breached != snap.breached:
                row.sla_breached = snap.breached
        return rows, meta

    @staticmethod
    async def get_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
    ) -> Incident:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id
        )
        if incident is None:
            raise NotFoundError("Incident not found.")
        if (
            principal.portal_type == PORTAL_END_USER
            and incident.requester_user_id != principal.user_id
        ):
            raise AuthorizationError("End users may only access their own incidents.")
        return incident

    @staticmethod
    async def create_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: IncidentCreateRequest,
        request: Request | None = None,
    ) -> Incident:
        await set_transaction_tenant_context(db, principal.organization_id)

        org = (
            await db.execute(
                select(Organization).where(Organization.id == principal.organization_id)
            )
        ).scalar_one_or_none()

        priority = payload.priority or calculate_priority(payload.impact, payload.urgency)
        now = datetime.now(timezone.utc)

        # Evaluate matching ticket routing rule & SLA policy
        rule = (
            await db.execute(
                select(TicketWorkflowRule)
                .where(
                    TicketWorkflowRule.organization_id == principal.organization_id,
                    TicketWorkflowRule.active.is_(True),
                    TicketWorkflowRule.deleted_at.is_(None),
                )
                .order_by(TicketWorkflowRule.created_at.asc())
            )
        ).scalars().all()
        matched_rule: TicketWorkflowRule | None = None
        for r in rule:
            if (
                r.source_channel in ("all", payload.source_channel)
                and r.match_category in ("all", payload.category)
                and r.match_priority in ("all", priority)
            ):
                matched_rule = r
                break

        sla_policy = (
            await db.execute(
                select(SlaPolicy).where(
                    SlaPolicy.organization_id == principal.organization_id,
                    SlaPolicy.priority == priority,
                    SlaPolicy.is_active.is_(True),
                    SlaPolicy.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        sla_deadline = compute_sla_deadline(
            created_at=now,
            priority=priority,
            org_sla_targets=org.sla_targets if org else None,
            override_hours=matched_rule.override_sla_hours if matched_rule else None,
            policy_resolution_mins=sla_policy.resolution_target_mins if sla_policy else None,
        )

        assignee_id, assignee_name = await IncidentService._resolve_assignee(
            db,
            organization_id=principal.organization_id,
            assignee_user_id=payload.assignee_user_id,
        )
        assignment_group = payload.assignment_group or (
            matched_rule.assign_to_queue if matched_rule else "Tier-1 Service Desk"
        )
        initial_status = "assigned" if assignee_id is not None else "new"
        number = await IncidentRepository.next_number(db, principal.organization_id)

        incident = Incident(
            organization_id=principal.organization_id,
            number=number,
            title=payload.title.strip(),
            description=payload.description.strip(),
            status=initial_status,
            priority=priority,
            urgency=payload.urgency,
            impact=payload.impact,
            category=payload.category,
            requester_user_id=principal.user_id,
            requester_name=principal.full_name,
            requester_email=principal.email,
            assignee_user_id=assignee_id,
            assignee_name=assignee_name,
            assignment_group=assignment_group,
            affected_ci_id=payload.affected_ci_id,
            affected_ci_label=payload.affected_ci_label,
            sla_policy_id=sla_policy.id if sla_policy else None,
            sla_deadline=sla_deadline,
            sla_breached=False,
            source_channel=payload.source_channel,
        )
        db.add(incident)
        await db.flush()

        if matched_rule is not None:
            matched_rule.execution_count += 1

        db.add(
            IncidentActivity(
                organization_id=principal.organization_id,
                incident_id=incident.id,
                author_user_id=principal.user_id,
                author_name=principal.full_name,
                activity_type="audit",
                action="Incident created",
                note=(
                    f"Opened {incident.number} ({priority}) via {payload.source_channel}. "
                    f"Assigned queue: {assignment_group}."
                ),
                field_changes=[
                    {"field": "status", "from": "none", "to": initial_status},
                    {"field": "priority", "from": "none", "to": priority},
                ],
            )
        )

        if assignee_id is not None and assignee_id != principal.user_id:
            db.add(
                Notification(
                    organization_id=principal.organization_id,
                    recipient_user_id=assignee_id,
                    category="incident",
                    title=f"Incident {incident.number} assigned",
                    message=incident.title,
                    record_type="incident",
                    record_id=str(incident.id),
                )
            )

        await AuditService.record(
            db,
            action="INCIDENT_CREATED",
            module="incidents",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="incident",
            target_id=str(incident.id),
            outcome="success",
            detail=f"Created incident {incident.number} ({priority}): {incident.title}.",
            metadata={"number": incident.number, "priority": priority, "category": payload.category},
            request=request,
        )
        await db.flush()
        return await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident.id
        )  # type: ignore[return-value]

    @staticmethod
    async def update_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        payload: IncidentUpdateRequest,
        request: Request | None = None,
    ) -> Incident:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id, for_update=True
        )
        if incident is None:
            raise NotFoundError("Incident not found.")

        updates = payload.model_dump(exclude_unset=True)
        note = updates.pop("note", None)
        changes: list[dict[str, str]] = []
        now = datetime.now(timezone.utc)

        if "status" in updates:
            new_status = updates["status"]
            if incident.status == "closed" and new_status != "closed" and not principal.is_super_admin:
                raise ConflictError("Closed incidents cannot be reopened without Super Admin clearance.")
            if new_status == "pending" and incident.sla_paused_at is None:
                incident.sla_paused_at = now
            elif new_status != "pending" and incident.sla_paused_at is not None:
                paused_delta = now - incident.sla_paused_at
                incident.sla_deadline = incident.sla_deadline + paused_delta
                incident.sla_paused_at = None

        for field, value in updates.items():
            old_val = getattr(incident, field)
            if old_val != value:
                changes.append({"field": field, "from": str(old_val), "to": str(value)})
                setattr(incident, field, value)

        # Recalculate priority if impact/urgency changed without explicit priority override
        if ("impact" in updates or "urgency" in updates) and "priority" not in updates:
            recomputed = calculate_priority(incident.impact, incident.urgency)
            if recomputed != incident.priority:
                changes.append({"field": "priority", "from": incident.priority, "to": recomputed})
                incident.priority = recomputed

        if changes or note:
            db.add(
                IncidentActivity(
                    organization_id=principal.organization_id,
                    incident_id=incident.id,
                    author_user_id=principal.user_id,
                    author_name=principal.full_name,
                    activity_type="field_change" if changes else "work_note",
                    action="Incident updated",
                    note=note or f"Updated {', '.join(c['field'] for c in changes)}.",
                    field_changes=changes,
                )
            )
            await AuditService.record(
                db,
                action="INCIDENT_UPDATED",
                module="incidents",
                actor_email=principal.email,
                actor_user_id=principal.user_id,
                organization_id=principal.organization_id,
                portal_type=principal.portal_type,
                target_type="incident",
                target_id=str(incident.id),
                outcome="success",
                detail=f"Updated {incident.number}.",
                metadata={"changes": changes},
                request=request,
            )

        await db.flush()
        return await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident.id
        )  # type: ignore[return-value]

    @staticmethod
    async def assign_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        payload: IncidentAssignRequest,
        request: Request | None = None,
    ) -> Incident:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id, for_update=True
        )
        if incident is None:
            raise NotFoundError("Incident not found.")

        prev_assignee = incident.assignee_name
        assignee_id, assignee_name = await IncidentService._resolve_assignee(
            db,
            organization_id=principal.organization_id,
            assignee_user_id=payload.assignee_user_id,
            fallback_name=payload.assignee_name,
        )
        incident.assignee_user_id = assignee_id
        incident.assignee_name = assignee_name
        if payload.assignment_group is not None:
            incident.assignment_group = payload.assignment_group
        if incident.status == "new" and assignee_name != "Unassigned":
            incident.status = "assigned"

        db.add(
            IncidentActivity(
                organization_id=principal.organization_id,
                incident_id=incident.id,
                author_user_id=principal.user_id,
                author_name=principal.full_name,
                activity_type="field_change",
                action="Incident assigned",
                note=payload.note or f"Assigned to {assignee_name}.",
                field_changes=[{"field": "assignee", "from": prev_assignee, "to": assignee_name}],
            )
        )
        if assignee_id is not None and assignee_id != principal.user_id:
            db.add(
                Notification(
                    organization_id=principal.organization_id,
                    recipient_user_id=assignee_id,
                    category="incident",
                    title=f"Incident {incident.number} assigned to you",
                    message=incident.title,
                    record_type="incident",
                    record_id=str(incident.id),
                )
            )
        await AuditService.record(
            db,
            action="INCIDENT_ASSIGNED",
            module="incidents",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="incident",
            target_id=str(incident.id),
            outcome="success",
            detail=f"Assigned {incident.number} from {prev_assignee} to {assignee_name}.",
            request=request,
        )
        await db.flush()
        return await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident.id
        )  # type: ignore[return-value]

    @staticmethod
    async def resolve_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        payload: IncidentResolveRequest,
        request: Request | None = None,
    ) -> Incident:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id, for_update=True
        )
        if incident is None:
            raise NotFoundError("Incident not found.")
        if incident.status == "closed":
            raise ConflictError("Closed incidents cannot be re-resolved.")

        now = datetime.now(timezone.utc)
        prev_status = incident.status
        incident.status = "resolved"
        incident.resolution_notes = payload.resolution_notes.strip()
        incident.resolved_at = now
        if payload.time_logged_mins is not None:
            incident.time_logged_mins += payload.time_logged_mins
        incident.sla_breached = now > incident.sla_deadline

        db.add(
            IncidentActivity(
                organization_id=principal.organization_id,
                incident_id=incident.id,
                author_user_id=principal.user_id,
                author_name=principal.full_name,
                activity_type="field_change",
                action="Incident resolved",
                note=incident.resolution_notes,
                field_changes=[{"field": "status", "from": prev_status, "to": "resolved"}],
            )
        )
        await AuditService.record(
            db,
            action="INCIDENT_RESOLVED",
            module="incidents",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="incident",
            target_id=str(incident.id),
            outcome="success",
            detail=f"Resolved {incident.number}.",
            request=request,
        )
        await db.flush()
        return await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident.id
        )  # type: ignore[return-value]

    @staticmethod
    async def close_incident(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        payload: IncidentCloseRequest,
        request: Request | None = None,
    ) -> Incident:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id, for_update=True
        )
        if incident is None:
            raise NotFoundError("Incident not found.")
        if incident.status not in {"resolved", "in_progress", "assigned"}:
            raise ValidationDomainError(
                f"Cannot close incident in status '{incident.status}'. Resolve it first."
            )

        now = datetime.now(timezone.utc)
        prev_status = incident.status
        incident.status = "closed"
        incident.closed_at = now
        if incident.resolved_at is None:
            incident.resolved_at = now
        if payload.csat_score is not None:
            incident.csat_score = payload.csat_score

        db.add(
            IncidentActivity(
                organization_id=principal.organization_id,
                incident_id=incident.id,
                author_user_id=principal.user_id,
                author_name=principal.full_name,
                activity_type="audit",
                action="Incident closed",
                note=payload.closure_note.strip(),
                field_changes=[{"field": "status", "from": prev_status, "to": "closed"}],
            )
        )
        await AuditService.record(
            db,
            action="INCIDENT_CLOSED",
            module="incidents",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="incident",
            target_id=str(incident.id),
            outcome="success",
            detail=f"Closed {incident.number}.",
            request=request,
        )
        await db.flush()
        return await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident.id
        )  # type: ignore[return-value]

    @staticmethod
    async def add_activity(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        payload: IncidentActivityCreateRequest,
    ) -> IncidentActivity:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id
        )
        if incident is None:
            raise NotFoundError("Incident not found.")
        if (
            principal.portal_type == PORTAL_END_USER
            and incident.requester_user_id != principal.user_id
        ):
            raise AuthorizationError("End users may only comment on their own incidents.")
        activity_type = "comment" if principal.portal_type == PORTAL_END_USER else payload.activity_type
        entry = IncidentActivity(
            organization_id=principal.organization_id,
            incident_id=incident.id,
            author_user_id=principal.user_id,
            author_name=principal.full_name,
            activity_type=activity_type,
            action=payload.action.strip(),
            note=payload.note.strip(),
            field_changes=[],
        )
        db.add(entry)
        await db.flush()
        return entry

    @staticmethod
    async def add_attachment(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        payload: IncidentAttachmentCreateRequest,
        request: Request | None = None,
    ) -> IncidentAttachment:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id
        )
        if incident is None:
            raise NotFoundError("Incident not found.")
        if (
            principal.portal_type == PORTAL_END_USER
            and incident.requester_user_id != principal.user_id
        ):
            raise AuthorizationError("End users may only attach files to their own incidents.")
        attachment = IncidentAttachment(
            organization_id=principal.organization_id,
            incident_id=incident.id,
            filename=payload.filename.strip(),
            content_type=payload.content_type.strip(),
            size_bytes=payload.size_bytes,
            storage_key=payload.storage_key.strip(),
            checksum_sha256=payload.checksum_sha256,
            uploaded_by_user_id=principal.user_id,
            uploaded_by_email=principal.email,
        )
        db.add(attachment)
        await db.flush()
        await AuditService.record(
            db,
            action="INCIDENT_ATTACHMENT_ADDED",
            module="incidents",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="incident",
            target_id=str(incident.id),
            outcome="success",
            detail=f"Attached '{attachment.filename}' to {incident.number}.",
            request=request,
        )
        return attachment

    @staticmethod
    async def add_relation(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        payload: IncidentRelationCreateRequest,
    ) -> IncidentRelation:
        await set_transaction_tenant_context(db, principal.organization_id)
        incident = await IncidentRepository.get_by_id(
            db, organization_id=principal.organization_id, incident_id=incident_id
        )
        if incident is None:
            raise NotFoundError("Incident not found.")
        if payload.target_type == "incident" and payload.target_id == incident.id:
            raise ValidationDomainError("An incident cannot be linked to itself.")

        relation = IncidentRelation(
            organization_id=principal.organization_id,
            incident_id=incident.id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            target_ref=payload.target_ref.strip(),
            relation_type=payload.relation_type,
            created_by_email=principal.email,
        )
        db.add(relation)
        await db.flush()
        return relation

    @staticmethod
    async def delete_relation(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        incident_id: uuid.UUID,
        relation_id: uuid.UUID,
    ) -> None:
        await set_transaction_tenant_context(db, principal.organization_id)
        rel = await IncidentRepository.get_relation(
            db,
            organization_id=principal.organization_id,
            incident_id=incident_id,
            relation_id=relation_id,
        )
        if rel is None:
            raise NotFoundError("Incident relation not found.")
        await db.delete(rel)
        await db.flush()
