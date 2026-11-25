from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import (
    AuthenticatedPrincipal,
    get_current_principal,
    require_any_permission,
    require_permissions,
)
from app.db.models.operations import (
    Invoice,
    ProjectItem,
    ServiceStatusComponent,
    TaskItem,
)
from app.db.session import get_db_session
from app.modules.operations.schemas import (
    GlobalSearchResponse,
    InvoiceCreateRequest,
    InvoiceOut,
    InvoicePayRequest,
    KnowledgeArticleOut,
    KnowledgeCreateRequest,
    KnowledgeUpdateRequest,
    NotificationOut,
    OperationsReportSummary,
    ProjectCreateRequest,
    ProjectOut,
    SlaPolicyOut,
    SlaPolicyUpsertRequest,
    StatusComponentOut,
    StatusComponentUpsertRequest,
    TaskCreateRequest,
    TaskMoveRequest,
    TaskOut,
    TicketWorkflowRuleCreateRequest,
    TicketWorkflowRuleOut,
    WorkflowCreateRequest,
    WorkflowOut,
    WorkflowUpdateRequest,
)
from app.modules.operations.service import OperationsService

router = APIRouter(tags=["Operations & Platform Modules"])


# --- SLA Management ---
@router.get("/sla-policies", response_model=list[SlaPolicyOut])
async def list_sla_policies(
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[SlaPolicyOut]:
    rows = await OperationsService.list_sla_policies(db, principal=principal)
    return [SlaPolicyOut.model_validate(r) for r in rows]


@router.put("/sla-policies", response_model=SlaPolicyOut)
async def upsert_sla_policy(
    payload: SlaPolicyUpsertRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("tenants:admin", "workflows:manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> SlaPolicyOut:
    row = await OperationsService.upsert_sla_policy(
        db, principal=principal, payload=payload, request=request
    )
    return SlaPolicyOut.model_validate(row)


# --- Knowledge Management ---
@router.get("/knowledge", response_model=list[KnowledgeArticleOut])
async def list_knowledge(
    category: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[KnowledgeArticleOut]:
    rows = await OperationsService.list_knowledge(
        db, principal=principal, category=category, search=search
    )
    return [KnowledgeArticleOut.model_validate(r) for r in rows]


@router.post("/knowledge", response_model=KnowledgeArticleOut, status_code=status.HTTP_201_CREATED)
async def create_knowledge(
    payload: KnowledgeCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> KnowledgeArticleOut:
    row = await OperationsService.create_knowledge(
        db, principal=principal, payload=payload, request=request
    )
    return KnowledgeArticleOut.model_validate(row)


@router.patch("/knowledge/{article_id}", response_model=KnowledgeArticleOut)
async def update_knowledge(
    article_id: uuid.UUID,
    payload: KnowledgeUpdateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> KnowledgeArticleOut:
    row = await OperationsService.update_knowledge(
        db, principal=principal, article_id=article_id, payload=payload
    )
    return KnowledgeArticleOut.model_validate(row)


@router.post("/knowledge/{article_id}/helpful", response_model=KnowledgeArticleOut)
async def vote_knowledge_helpful(
    article_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> KnowledgeArticleOut:
    row = await OperationsService.vote_knowledge_helpful(
        db, principal=principal, article_id=article_id
    )
    return KnowledgeArticleOut.model_validate(row)


# --- Workflow Management & Ticket Routing Rules ---
@router.get("/workflows", response_model=list[WorkflowOut])
async def list_workflows(
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[WorkflowOut]:
    rows = await OperationsService.list_workflows(db, principal=principal)
    return [WorkflowOut.model_validate(r) for r in rows]


@router.post("/workflows", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> WorkflowOut:
    row = await OperationsService.create_workflow(
        db, principal=principal, payload=payload, request=request
    )
    return WorkflowOut.model_validate(row)


@router.patch("/workflows/{workflow_id}", response_model=WorkflowOut)
async def update_workflow(
    workflow_id: uuid.UUID,
    payload: WorkflowUpdateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> WorkflowOut:
    row = await OperationsService.update_workflow(
        db, principal=principal, workflow_id=workflow_id, payload=payload
    )
    return WorkflowOut.model_validate(row)


@router.post("/workflows/{workflow_id}/execute", response_model=WorkflowOut)
async def execute_workflow(
    workflow_id: uuid.UUID,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> WorkflowOut:
    row = await OperationsService.execute_workflow(
        db, principal=principal, workflow_id=workflow_id, request=request
    )
    return WorkflowOut.model_validate(row)


@router.get("/ticket-workflows", response_model=list[TicketWorkflowRuleOut])
async def list_ticket_rules(
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> list[TicketWorkflowRuleOut]:
    rows = await OperationsService.list_ticket_rules(db, principal=principal)
    return [TicketWorkflowRuleOut.model_validate(r) for r in rows]


@router.post(
    "/ticket-workflows",
    response_model=TicketWorkflowRuleOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket_rule(
    payload: TicketWorkflowRuleCreateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("workflows:manage")),
    db: AsyncSession = Depends(get_db_session),
) -> TicketWorkflowRuleOut:
    row = await OperationsService.create_ticket_rule(
        db, principal=principal, payload=payload
    )
    return TicketWorkflowRuleOut.model_validate(row)


# --- Notifications ---
@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    unread_only: bool = Query(default=False),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[NotificationOut]:
    rows = await OperationsService.list_notifications(
        db, principal=principal, unread_only=unread_only
    )
    return [NotificationOut.model_validate(r) for r in rows]


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> NotificationOut:
    row = await OperationsService.mark_notification_read(
        db, principal=principal, notification_id=notification_id
    )
    return NotificationOut.model_validate(row)


# --- Reports & Analytics ---
@router.get("/reports/summary", response_model=OperationsReportSummary)
async def get_reports_summary(
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("audit:read", "iam:manage", "billing:read", "incidents:write")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> OperationsReportSummary:
    return await OperationsService.get_report_summary(db, principal=principal)


# --- RBAC-Scoped Global Search ---
@router.get("/search", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(default="", max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> GlobalSearchResponse:
    return await OperationsService.global_search(
        db, principal=principal, query=q, limit=limit
    )


# --- Tasks, Projects, Service Status, Finance Invoices ---
@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> list[TaskOut]:
    rows = (
        await db.execute(
            select(TaskItem)
            .where(
                TaskItem.organization_id == principal.organization_id,
                TaskItem.deleted_at.is_(None),
            )
            .order_by(TaskItem.created_at.desc())
        )
    ).scalars().all()
    return [TaskOut.model_validate(r) for r in rows]


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> TaskOut:
    row = await OperationsService.create_task(db, principal=principal, payload=payload)
    return TaskOut.model_validate(row)


@router.patch("/tasks/{task_id}/move", response_model=TaskOut)
async def move_task(
    task_id: uuid.UUID,
    payload: TaskMoveRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> TaskOut:
    row = await OperationsService.move_task(
        db, principal=principal, task_id=task_id, payload=payload
    )
    return TaskOut.model_validate(row)


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> list[ProjectOut]:
    rows = (
        await db.execute(
            select(ProjectItem)
            .where(
                ProjectItem.organization_id == principal.organization_id,
                ProjectItem.deleted_at.is_(None),
            )
            .order_by(ProjectItem.created_at.desc())
        )
    ).scalars().all()
    return [ProjectOut.model_validate(r) for r in rows]


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> ProjectOut:
    row = await OperationsService.create_project(db, principal=principal, payload=payload)
    return ProjectOut.model_validate(row)


@router.get("/status-components", response_model=list[StatusComponentOut])
async def list_status_components(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db_session),
) -> list[StatusComponentOut]:
    rows = (
        await db.execute(
            select(ServiceStatusComponent)
            .where(ServiceStatusComponent.organization_id == principal.organization_id)
            .order_by(ServiceStatusComponent.component_group.asc(), ServiceStatusComponent.name.asc())
        )
    ).scalars().all()
    return [StatusComponentOut.model_validate(r) for r in rows]


@router.post(
    "/status-components",
    response_model=StatusComponentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_status_component(
    payload: StatusComponentUpsertRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("incidents:write")),
    db: AsyncSession = Depends(get_db_session),
) -> StatusComponentOut:
    row = await OperationsService.create_status_component(
        db, principal=principal, payload=payload
    )
    return StatusComponentOut.model_validate(row)


@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    principal: AuthenticatedPrincipal = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[InvoiceOut]:
    rows = (
        await db.execute(
            select(Invoice)
            .where(
                Invoice.organization_id == principal.organization_id,
                Invoice.deleted_at.is_(None),
            )
            .order_by(Invoice.created_at.desc())
        )
    ).scalars().all()
    return [InvoiceOut.model_validate(r) for r in rows]


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreateRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db_session),
) -> InvoiceOut:
    row = await OperationsService.create_invoice(db, principal=principal, payload=payload)
    return InvoiceOut.model_validate(row)


@router.post("/invoices/{invoice_id}/pay", response_model=InvoiceOut)
async def pay_invoice(
    invoice_id: uuid.UUID,
    payload: InvoicePayRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("billing:read")),
    db: AsyncSession = Depends(get_db_session),
) -> InvoiceOut:
    row = await OperationsService.pay_invoice(
        db, principal=principal, invoice_id=invoice_id, payload=payload, request=request
    )
    return InvoiceOut.model_validate(row)
