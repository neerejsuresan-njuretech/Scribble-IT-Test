from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.permissions import PORTAL_END_USER
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.audit import AuditLog
from app.db.models.cmdb import Asset, InventoryItem, SoftwareLicense
from app.db.models.itsm import ChangeRequest, Incident, Problem, ServiceRequest
from app.db.models.operations import (
    Invoice,
    KnowledgeArticle,
    Notification,
    ProjectItem,
    ServiceStatusComponent,
    SlaPolicy,
    TaskItem,
    TicketWorkflowRule,
    WorkflowDefinition,
)
from app.db.session import set_transaction_tenant_context
from app.modules.audit.service import AuditService
from app.modules.operations.schemas import (
    GlobalSearchHit,
    GlobalSearchResponse,
    InvoiceCreateRequest,
    InvoicePayRequest,
    KnowledgeCreateRequest,
    KnowledgeUpdateRequest,
    OperationsReportSummary,
    ProjectCreateRequest,
    SlaPolicyUpsertRequest,
    StatusComponentUpsertRequest,
    TaskCreateRequest,
    TaskMoveRequest,
    TicketWorkflowRuleCreateRequest,
    WorkflowCreateRequest,
    WorkflowUpdateRequest,
)


class OperationsService:
    """Tenant-scoped service for SLA Policies, KB, Workflows, Notifications, Reports, Search, Tasks, Projects, Status & Billing."""

    # --- SLA Policies ---
    @staticmethod
    async def list_sla_policies(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> list[SlaPolicy]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(SlaPolicy)
                .where(
                    SlaPolicy.organization_id == principal.organization_id,
                    SlaPolicy.deleted_at.is_(None),
                )
                .order_by(SlaPolicy.priority.asc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def upsert_sla_policy(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: SlaPolicyUpsertRequest,
        request: Request | None = None,
    ) -> SlaPolicy:
        await set_transaction_tenant_context(db, principal.organization_id)
        policy = (
            await db.execute(
                select(SlaPolicy).where(
                    SlaPolicy.organization_id == principal.organization_id,
                    SlaPolicy.priority == payload.priority,
                    SlaPolicy.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if policy is None:
            policy = SlaPolicy(
                organization_id=principal.organization_id,
                name=payload.name.strip(),
                priority=payload.priority,
                response_target_mins=payload.response_target_mins,
                resolution_target_mins=payload.resolution_target_mins,
                escalation_minutes=payload.escalation_minutes,
                business_hours_only=payload.business_hours_only,
                is_active=payload.is_active,
            )
            db.add(policy)
        else:
            policy.name = payload.name.strip()
            policy.response_target_mins = payload.response_target_mins
            policy.resolution_target_mins = payload.resolution_target_mins
            policy.escalation_minutes = payload.escalation_minutes
            policy.business_hours_only = payload.business_hours_only
            policy.is_active = payload.is_active
        await db.flush()
        await AuditService.record(
            db,
            action="SLA_POLICY_UPSERTED",
            module="sla",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="sla_policy",
            target_id=str(policy.id),
            outcome="success",
            detail=f"Configured SLA policy '{policy.name}' for {policy.priority} ({policy.resolution_target_mins}m resolution).",
            request=request,
        )
        return policy

    # --- Knowledge Base ---
    @staticmethod
    async def list_knowledge(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        category: str | None = None,
        search: str | None = None,
    ) -> list[KnowledgeArticle]:
        await set_transaction_tenant_context(db, principal.organization_id)
        stmt = select(KnowledgeArticle).where(
            KnowledgeArticle.organization_id == principal.organization_id,
            KnowledgeArticle.deleted_at.is_(None),
            KnowledgeArticle.is_published.is_(True),
        )
        if principal.portal_type == PORTAL_END_USER:
            stmt = stmt.where(KnowledgeArticle.visibility == "public")
        if category:
            stmt = stmt.where(KnowledgeArticle.category == category)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    KnowledgeArticle.title.ilike(term),
                    KnowledgeArticle.content.ilike(term),
                    KnowledgeArticle.category.ilike(term),
                )
            )
        stmt = stmt.order_by(KnowledgeArticle.updated_at.desc())
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def create_knowledge(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: KnowledgeCreateRequest,
        request: Request | None = None,
    ) -> KnowledgeArticle:
        await set_transaction_tenant_context(db, principal.organization_id)
        art = KnowledgeArticle(
            organization_id=principal.organization_id,
            title=payload.title.strip(),
            category=payload.category.strip(),
            visibility=payload.visibility,
            author_user_id=principal.user_id,
            author_name=principal.full_name,
            tags=payload.tags,
            content=payload.content,
            is_published=True,
        )
        db.add(art)
        await db.flush()
        await AuditService.record(
            db,
            action="KB_ARTICLE_CREATED",
            module="knowledge",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="knowledge_article",
            target_id=str(art.id),
            outcome="success",
            detail=f"Published KB article '{art.title}' ({art.visibility}).",
            request=request,
        )
        return art

    @staticmethod
    async def update_knowledge(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        article_id: uuid.UUID,
        payload: KnowledgeUpdateRequest,
    ) -> KnowledgeArticle:
        await set_transaction_tenant_context(db, principal.organization_id)
        art = (
            await db.execute(
                select(KnowledgeArticle).where(
                    KnowledgeArticle.id == article_id,
                    KnowledgeArticle.organization_id == principal.organization_id,
                    KnowledgeArticle.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if art is None:
            raise NotFoundError("Knowledge article not found.")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(art, field, val)
        await db.flush()
        return art

    @staticmethod
    async def vote_knowledge_helpful(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        article_id: uuid.UUID,
    ) -> KnowledgeArticle:
        await set_transaction_tenant_context(db, principal.organization_id)
        art = (
            await db.execute(
                select(KnowledgeArticle)
                .where(
                    KnowledgeArticle.id == article_id,
                    KnowledgeArticle.organization_id == principal.organization_id,
                    KnowledgeArticle.deleted_at.is_(None),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if art is None:
            raise NotFoundError("Knowledge article not found.")
        art.helpful_votes += 1
        await db.flush()
        return art

    # --- Workflows & Ticket Routing Rules ---
    @staticmethod
    async def list_workflows(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> list[WorkflowDefinition]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(WorkflowDefinition)
                .where(
                    WorkflowDefinition.organization_id == principal.organization_id,
                    WorkflowDefinition.deleted_at.is_(None),
                )
                .order_by(WorkflowDefinition.updated_at.desc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def create_workflow(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: WorkflowCreateRequest,
        request: Request | None = None,
    ) -> WorkflowDefinition:
        await set_transaction_tenant_context(db, principal.organization_id)
        wf = WorkflowDefinition(
            organization_id=principal.organization_id,
            name=payload.name.strip(),
            target_module_id=payload.target_module_id,
            trigger=payload.trigger,
            trigger_config=payload.trigger_config,
            description=payload.description.strip(),
            status=payload.status,
            stages=payload.stages,
        )
        db.add(wf)
        await db.flush()
        await AuditService.record(
            db,
            action="WORKFLOW_CREATED",
            module="workflows",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="workflow",
            target_id=str(wf.id),
            outcome="success",
            detail=f"Created workflow '{wf.name}' ({wf.status}).",
            request=request,
        )
        return wf

    @staticmethod
    async def update_workflow(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        workflow_id: uuid.UUID,
        payload: WorkflowUpdateRequest,
    ) -> WorkflowDefinition:
        await set_transaction_tenant_context(db, principal.organization_id)
        wf = (
            await db.execute(
                select(WorkflowDefinition).where(
                    WorkflowDefinition.id == workflow_id,
                    WorkflowDefinition.organization_id == principal.organization_id,
                    WorkflowDefinition.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if wf is None:
            raise NotFoundError("Workflow definition not found.")
        for field, val in payload.model_dump(exclude_unset=True).items():
            setattr(wf, field, val)
        await db.flush()
        return wf

    @staticmethod
    async def execute_workflow(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        workflow_id: uuid.UUID,
        request: Request | None = None,
    ) -> WorkflowDefinition:
        await set_transaction_tenant_context(db, principal.organization_id)
        wf = (
            await db.execute(
                select(WorkflowDefinition)
                .where(
                    WorkflowDefinition.id == workflow_id,
                    WorkflowDefinition.organization_id == principal.organization_id,
                    WorkflowDefinition.deleted_at.is_(None),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if wf is None:
            raise NotFoundError("Workflow definition not found.")

        now = datetime.now(timezone.utc)
        trace = [
            {
                "step_id": str(stage.get("id", f"step-{idx+1}")),
                "step_name": str(stage.get("name", f"Stage {idx+1}")),
                "status": "succeeded",
                "executed_at": now.isoformat(),
            }
            for idx, stage in enumerate(wf.stages)
        ]
        wf.execution_count += 1
        wf.last_executed_at = now
        wf.last_run_trace = trace
        await db.flush()
        await AuditService.record(
            db,
            action="WORKFLOW_EXECUTED",
            module="workflows",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="workflow",
            target_id=str(wf.id),
            outcome="success",
            detail=f"Executed workflow '{wf.name}' ({len(trace)} stage(s)).",
            request=request,
        )
        return wf

    @staticmethod
    async def list_ticket_rules(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> list[TicketWorkflowRule]:
        await set_transaction_tenant_context(db, principal.organization_id)
        rows = (
            await db.execute(
                select(TicketWorkflowRule)
                .where(
                    TicketWorkflowRule.organization_id == principal.organization_id,
                    TicketWorkflowRule.deleted_at.is_(None),
                )
                .order_by(TicketWorkflowRule.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    async def create_ticket_rule(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: TicketWorkflowRuleCreateRequest,
    ) -> TicketWorkflowRule:
        await set_transaction_tenant_context(db, principal.organization_id)
        rule = TicketWorkflowRule(
            organization_id=principal.organization_id,
            name=payload.name.strip(),
            active=payload.active,
            source_channel=payload.source_channel,
            match_category=payload.match_category,
            match_priority=payload.match_priority,
            assign_to_queue=payload.assign_to_queue.strip(),
            override_sla_hours=payload.override_sla_hours,
            auto_escalate_after_mins=payload.auto_escalate_after_mins,
            allowed_transitions=payload.allowed_transitions,
            notify_roles=payload.notify_roles,
        )
        db.add(rule)
        await db.flush()
        return rule

    # --- Notifications ---
    @staticmethod
    async def list_notifications(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        unread_only: bool = False,
    ) -> list[Notification]:
        await set_transaction_tenant_context(db, principal.organization_id)
        stmt = select(Notification).where(
            Notification.organization_id == principal.organization_id,
            Notification.recipient_user_id == principal.user_id,
        )
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.order_by(Notification.created_at.desc()).limit(100)
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def mark_notification_read(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        notification_id: uuid.UUID,
    ) -> Notification:
        await set_transaction_tenant_context(db, principal.organization_id)
        row = (
            await db.execute(
                select(Notification).where(
                    Notification.id == notification_id,
                    Notification.organization_id == principal.organization_id,
                    Notification.recipient_user_id == principal.user_id,
                )
            )
        ).scalar_one_or_none()
        if row is None:
            raise NotFoundError("Notification not found.")
        row.is_read = True
        row.read_at = datetime.now(timezone.utc)
        await db.flush()
        return row

    # --- Reports & Analytics ---
    @staticmethod
    async def get_report_summary(
        db: AsyncSession, *, principal: AuthenticatedPrincipal
    ) -> OperationsReportSummary:
        await set_transaction_tenant_context(db, principal.organization_id)
        org_id = principal.organization_id

        inc_rows = list(
            (
                await db.execute(
                    select(Incident.status, Incident.priority, Incident.sla_breached).where(
                        Incident.organization_id == org_id,
                        Incident.deleted_at.is_(None),
                    )
                )
            ).all()
        )
        by_priority = {"P1": 0, "P2": 0, "P3": 0, "P4": 0}
        open_inc = 0
        breached_inc = 0
        for st, pri, breached in inc_rows:
            if pri in by_priority:
                by_priority[pri] += 1
            if st not in {"resolved", "closed"}:
                open_inc += 1
            if breached:
                breached_inc += 1

        req_total = int(
            (
                await db.execute(
                    select(func.count(ServiceRequest.id)).where(
                        ServiceRequest.organization_id == org_id,
                        ServiceRequest.deleted_at.is_(None),
                    )
                )
            ).scalar_one()
        )
        req_pending = int(
            (
                await db.execute(
                    select(func.count(ServiceRequest.id)).where(
                        ServiceRequest.organization_id == org_id,
                        ServiceRequest.deleted_at.is_(None),
                        ServiceRequest.status.in_(["submitted", "manager_approved", "security_review"]),
                    )
                )
            ).scalar_one()
        )
        prb_total = int(
            (
                await db.execute(
                    select(func.count(Problem.id)).where(
                        Problem.organization_id == org_id, Problem.deleted_at.is_(None)
                    )
                )
            ).scalar_one()
        )
        kedb_total = int(
            (
                await db.execute(
                    select(func.count(Problem.id)).where(
                        Problem.organization_id == org_id,
                        Problem.deleted_at.is_(None),
                        Problem.is_known_error.is_(True),
                    )
                )
            ).scalar_one()
        )
        chg_total = int(
            (
                await db.execute(
                    select(func.count(ChangeRequest.id)).where(
                        ChangeRequest.organization_id == org_id,
                        ChangeRequest.deleted_at.is_(None),
                    )
                )
            ).scalar_one()
        )
        chg_cab = int(
            (
                await db.execute(
                    select(func.count(ChangeRequest.id)).where(
                        ChangeRequest.organization_id == org_id,
                        ChangeRequest.deleted_at.is_(None),
                        ChangeRequest.status == "cab_review",
                    )
                )
            ).scalar_one()
        )
        assets_total = int(
            (
                await db.execute(
                    select(func.count(Asset.id)).where(
                        Asset.organization_id == org_id, Asset.deleted_at.is_(None)
                    )
                )
            ).scalar_one()
        )
        assets_in_use = int(
            (
                await db.execute(
                    select(func.count(Asset.id)).where(
                        Asset.organization_id == org_id,
                        Asset.deleted_at.is_(None),
                        Asset.status == "in_use",
                    )
                )
            ).scalar_one()
        )
        inv_low = int(
            (
                await db.execute(
                    select(func.count(InventoryItem.id)).where(
                        InventoryItem.organization_id == org_id,
                        InventoryItem.deleted_at.is_(None),
                        InventoryItem.quantity <= InventoryItem.min_threshold,
                    )
                )
            ).scalar_one()
        )
        sw_over = int(
            (
                await db.execute(
                    select(func.count(SoftwareLicense.id)).where(
                        SoftwareLicense.organization_id == org_id,
                        SoftwareLicense.deleted_at.is_(None),
                        SoftwareLicense.compliance_status == "over_allocated",
                    )
                )
            ).scalar_one()
        )
        audit_count = int(
            (
                await db.execute(
                    select(func.count(AuditLog.id)).where(AuditLog.organization_id == org_id)
                )
            ).scalar_one()
        )

        return OperationsReportSummary(
            organization_id=org_id,
            generated_at=datetime.now(timezone.utc),
            incidents_total=len(inc_rows),
            incidents_open=open_inc,
            incidents_breached_sla=breached_inc,
            incidents_by_priority=by_priority,
            requests_total=req_total,
            requests_pending_approval=req_pending,
            problems_total=prb_total,
            known_errors_total=kedb_total,
            changes_total=chg_total,
            changes_in_cab_review=chg_cab,
            assets_total=assets_total,
            assets_in_use=assets_in_use,
            inventory_low_stock=inv_low,
            software_over_allocated=sw_over,
            audit_events_count=audit_count,
        )

    # --- Server-Side RBAC & Tenant-Scoped Global Search ---
    @staticmethod
    async def global_search(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        query: str,
        limit: int = 20,
    ) -> GlobalSearchResponse:
        await set_transaction_tenant_context(db, principal.organization_id)
        cleaned = query.strip()
        if not cleaned:
            return GlobalSearchResponse(
                query="",
                organization_id=principal.organization_id,
                total=0,
                hits=[],
            )
        term = f"%{cleaned}%"
        hits: list[GlobalSearchHit] = []
        is_end_user = principal.portal_type == PORTAL_END_USER

        # Incidents (requires incidents:read; end users restricted to own records)
        if principal.has_permission("incidents:read"):
            inc_stmt = select(Incident).where(
                Incident.organization_id == principal.organization_id,
                Incident.deleted_at.is_(None),
                or_(Incident.number.ilike(term), Incident.title.ilike(term), Incident.description.ilike(term)),
            )
            if is_end_user:
                inc_stmt = inc_stmt.where(Incident.requester_user_id == principal.user_id)
            for inc in (await db.execute(inc_stmt.limit(6))).scalars().all():
                hits.append(
                    GlobalSearchHit(
                        id=str(inc.id),
                        ref=inc.number,
                        group="Incidents",
                        title=inc.title,
                        subtitle=f"{inc.priority} · {inc.category} · {inc.assignee_name}",
                        status=inc.status,
                        path="/portal" if is_end_user else "/incidents",
                    )
                )

        # Service Requests
        if is_end_user or principal.has_permission("incidents:read") or principal.has_permission("requests:approve"):
            req_stmt = select(ServiceRequest).where(
                ServiceRequest.organization_id == principal.organization_id,
                ServiceRequest.deleted_at.is_(None),
                or_(
                    ServiceRequest.number.ilike(term),
                    ServiceRequest.catalog_item_name.ilike(term),
                    ServiceRequest.description.ilike(term),
                ),
            )
            if is_end_user:
                req_stmt = req_stmt.where(ServiceRequest.requester_user_id == principal.user_id)
            for req in (await db.execute(req_stmt.limit(6))).scalars().all():
                hits.append(
                    GlobalSearchHit(
                        id=str(req.id),
                        ref=req.number,
                        group="Tickets & Requests",
                        title=req.catalog_item_name,
                        subtitle=f"{req.department} · Stage {req.current_stage}/4",
                        status=req.status,
                        path="/portal" if is_end_user else "/requests",
                    )
                )

        # Assets (CMDB)
        if principal.has_permission("assets:read"):
            ast_stmt = select(Asset).where(
                Asset.organization_id == principal.organization_id,
                Asset.deleted_at.is_(None),
                or_(
                    Asset.asset_tag.ilike(term),
                    Asset.name.ilike(term),
                    Asset.serial_number.ilike(term),
                    Asset.ip_address.ilike(term),
                ),
            )
            if is_end_user:
                ast_stmt = ast_stmt.where(Asset.assigned_to_user_id == principal.user_id)
            for ast in (await db.execute(ast_stmt.limit(6))).scalars().all():
                hits.append(
                    GlobalSearchHit(
                        id=str(ast.id),
                        ref=ast.asset_tag,
                        group="Assets (CMDB)",
                        title=ast.name,
                        subtitle=f"{ast.asset_type} · SN: {ast.serial_number}",
                        status=ast.status,
                        path="/portal" if is_end_user else "/assets",
                    )
                )

        # Problems & Changes (corporate only)
        if not is_end_user and principal.has_permission("incidents:read"):
            prb_stmt = select(Problem).where(
                Problem.organization_id == principal.organization_id,
                Problem.deleted_at.is_(None),
                or_(Problem.number.ilike(term), Problem.title.ilike(term)),
            )
            for prb in (await db.execute(prb_stmt.limit(4))).scalars().all():
                hits.append(
                    GlobalSearchHit(
                        id=str(prb.id),
                        ref=prb.number,
                        group="Problems & Changes",
                        title=prb.title,
                        subtitle=f"Problem · {prb.severity}",
                        status=prb.status,
                        path="/problems",
                    )
                )

        if not is_end_user and (
            principal.has_permission("incidents:read") or principal.has_permission("changes:cab_vote")
        ):
            chg_stmt = select(ChangeRequest).where(
                ChangeRequest.organization_id == principal.organization_id,
                ChangeRequest.deleted_at.is_(None),
                or_(ChangeRequest.number.ilike(term), ChangeRequest.title.ilike(term)),
            )
            for chg in (await db.execute(chg_stmt.limit(4))).scalars().all():
                hits.append(
                    GlobalSearchHit(
                        id=str(chg.id),
                        ref=chg.number,
                        group="Problems & Changes",
                        title=chg.title,
                        subtitle=f"Change ({chg.change_type}) · Risk {chg.risk_score}",
                        status=chg.status,
                        path="/changes",
                    )
                )

        # Knowledge Base (public only for end users)
        kb_stmt = select(KnowledgeArticle).where(
            KnowledgeArticle.organization_id == principal.organization_id,
            KnowledgeArticle.deleted_at.is_(None),
            KnowledgeArticle.is_published.is_(True),
            or_(KnowledgeArticle.title.ilike(term), KnowledgeArticle.content.ilike(term)),
        )
        if is_end_user:
            kb_stmt = kb_stmt.where(KnowledgeArticle.visibility == "public")
        for kb in (await db.execute(kb_stmt.limit(4))).scalars().all():
            hits.append(
                GlobalSearchHit(
                    id=str(kb.id),
                    ref=f"KB-{str(kb.id)[:6].upper()}",
                    group="Knowledge Base",
                    title=kb.title,
                    subtitle=f"{kb.category} · {kb.visibility}",
                    status="published",
                    path="/knowledge",
                )
            )

        trimmed = hits[:limit]
        return GlobalSearchResponse(
            query=cleaned,
            organization_id=principal.organization_id,
            total=len(trimmed),
            hits=trimmed,
        )

    # --- Tasks, Projects, Status Page, Invoices ---
    @staticmethod
    async def create_task(
        db: AsyncSession, *, principal: AuthenticatedPrincipal, payload: TaskCreateRequest
    ) -> TaskItem:
        await set_transaction_tenant_context(db, principal.organization_id)
        row = TaskItem(
            organization_id=principal.organization_id,
            title=payload.title.strip(),
            description=payload.description.strip(),
            column_name=payload.column_name,
            priority=payload.priority,
            assignee_name=payload.assignee_name.strip(),
            due_date=payload.due_date,
            linked_record_id=payload.linked_record_id,
            project_id=payload.project_id,
            subtasks=payload.subtasks,
        )
        db.add(row)
        await db.flush()
        return row

    @staticmethod
    async def move_task(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        task_id: uuid.UUID,
        payload: TaskMoveRequest,
    ) -> TaskItem:
        await set_transaction_tenant_context(db, principal.organization_id)
        row = (
            await db.execute(
                select(TaskItem).where(
                    TaskItem.id == task_id,
                    TaskItem.organization_id == principal.organization_id,
                    TaskItem.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if row is None:
            raise NotFoundError("Task not found.")
        row.column_name = payload.column_name
        await db.flush()
        return row

    @staticmethod
    async def create_project(
        db: AsyncSession, *, principal: AuthenticatedPrincipal, payload: ProjectCreateRequest
    ) -> ProjectItem:
        await set_transaction_tenant_context(db, principal.organization_id)
        code = payload.code.upper().strip()
        dup = (
            await db.execute(
                select(ProjectItem).where(
                    ProjectItem.organization_id == principal.organization_id,
                    ProjectItem.code == code,
                    ProjectItem.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if dup is not None:
            raise ConflictError(f"Project code '{code}' already exists.")
        row = ProjectItem(
            organization_id=principal.organization_id,
            code=code,
            title=payload.title.strip(),
            owner_name=payload.owner_name.strip(),
            stage=payload.stage,
            health=payload.health,
            progress_pct=payload.progress_pct,
            budget_total=payload.budget_total,
            start_date=payload.start_date,
            target_end_date=payload.target_end_date,
            summary=payload.summary.strip(),
        )
        db.add(row)
        await db.flush()
        return row

    @staticmethod
    async def create_status_component(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: StatusComponentUpsertRequest,
    ) -> ServiceStatusComponent:
        await set_transaction_tenant_context(db, principal.organization_id)
        row = ServiceStatusComponent(
            organization_id=principal.organization_id,
            name=payload.name.strip(),
            component_group=payload.component_group.strip(),
            status=payload.status,
            uptime_pct=payload.uptime_pct,
            latency_ms=payload.latency_ms,
            linked_incident_id=payload.linked_incident_id,
        )
        db.add(row)
        await db.flush()
        return row

    @staticmethod
    async def create_invoice(
        db: AsyncSession, *, principal: AuthenticatedPrincipal, payload: InvoiceCreateRequest
    ) -> Invoice:
        await set_transaction_tenant_context(db, principal.organization_id)
        count = int(
            (
                await db.execute(
                    select(func.count(Invoice.id)).where(
                        Invoice.organization_id == principal.organization_id
                    )
                )
            ).scalar_one()
        )
        inv = Invoice(
            organization_id=principal.organization_id,
            number=f"INV-{5001 + count}",
            customer_name=payload.customer_name.strip(),
            customer_email=str(payload.customer_email).lower(),
            customer_organization=payload.customer_organization.strip(),
            amount=payload.amount,
            currency=payload.currency.upper().strip(),
            status="pending",
            issue_date=payload.issue_date,
            due_date=payload.due_date,
            line_items=payload.line_items,
            notes=payload.notes,
        )
        db.add(inv)
        await db.flush()
        return inv

    @staticmethod
    async def pay_invoice(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        invoice_id: uuid.UUID,
        payload: InvoicePayRequest,
        request: Request | None = None,
    ) -> Invoice:
        await set_transaction_tenant_context(db, principal.organization_id)
        inv = (
            await db.execute(
                select(Invoice)
                .where(
                    Invoice.id == invoice_id,
                    Invoice.organization_id == principal.organization_id,
                    Invoice.deleted_at.is_(None),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if inv is None:
            raise NotFoundError("Invoice not found.")
        inv.status = "paid"
        inv.payment_method = payload.payment_method
        inv.paid_at = datetime.now(timezone.utc)
        await db.flush()
        await AuditService.record(
            db,
            action="INVOICE_PAID",
            module="finance",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="invoice",
            target_id=str(inv.id),
            outcome="success",
            detail=f"Marked invoice {inv.number} paid via {payload.payment_method}.",
            request=request,
        )
        return inv
