from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationDomainError
from app.core.pagination import PageMeta
from app.core.permissions import PORTAL_END_USER
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.approvals import ApprovalWorkflowItem
from app.db.models.identity import OrganizationMembership
from app.db.models.itsm import ServiceCatalogItem, ServiceRequest, ServiceRequestActivity
from app.db.models.operations import Notification
from app.db.session import set_transaction_tenant_context
from app.modules.approvals.schemas import (
    ApprovalDecisionRequest,
    ApprovalItemCreateRequest,
    ApprovalItemOut,
    ApprovalReassignRequest,
)
from app.modules.approvals.service import ApprovalsService
from app.modules.audit.service import AuditService
from app.modules.requests.repository import ServiceRequestRepository
from app.modules.requests.schemas import (
    CatalogItemCreateRequest,
    ServiceRequestActivityOut,
    ServiceRequestAssignRequest,
    ServiceRequestCreateRequest,
    ServiceRequestFulfillRequest,
    ServiceRequestOut,
)


class ServiceRequestService:
    """Service Catalog & Request Fulfillment service integrated with designated ApprovalsService."""

    @staticmethod
    async def _serialize(
        db: AsyncSession,
        req: ServiceRequest,
    ) -> ServiceRequestOut:
        approvals = await ServiceRequestRepository.list_approvals_for_request(
            db, organization_id=req.organization_id, request_number=req.number
        )
        return ServiceRequestOut(
            id=req.id,
            organization_id=req.organization_id,
            number=req.number,
            catalog_item_id=req.catalog_item_id,
            catalog_item_name=req.catalog_item_name,
            description=req.description,
            requester_user_id=req.requester_user_id,
            requester_name=req.requester_name,
            requester_email=req.requester_email,
            assignee_user_id=req.assignee_user_id,
            assignee_name=req.assignee_name,
            department=req.department,
            cost=req.cost,
            status=req.status,
            current_stage=req.current_stage,
            delivery_estimate_days=req.delivery_estimate_days,
            delivery_date=req.delivery_date,
            fulfillment_notes=req.fulfillment_notes,
            completed_at=req.completed_at,
            custom_form_values=req.custom_form_values,
            created_at=req.created_at,
            updated_at=req.updated_at,
            approvals=[ApprovalItemOut.model_validate(a) for a in approvals],
            activities=[ServiceRequestActivityOut.model_validate(a) for a in req.activities],
        )

    @staticmethod
    async def create_catalog_item(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: CatalogItemCreateRequest,
        request: Request | None = None,
    ) -> ServiceCatalogItem:
        await set_transaction_tenant_context(db, principal.organization_id)
        existing = (
            await db.execute(
                select(ServiceCatalogItem).where(
                    ServiceCatalogItem.organization_id == principal.organization_id,
                    ServiceCatalogItem.slug == payload.slug.lower(),
                    ServiceCatalogItem.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise ConflictError(f"Catalog item slug '{payload.slug}' already exists.")

        item = ServiceCatalogItem(
            organization_id=principal.organization_id,
            slug=payload.slug.lower().strip(),
            title=payload.title.strip(),
            description=payload.description.strip(),
            category=payload.category.strip(),
            price=payload.price,
            estimated_hours=payload.estimated_hours,
            requires_approval=payload.requires_approval,
            default_approval_stages=payload.default_approval_stages,
            tags=payload.tags,
            is_active=True,
        )
        db.add(item)
        await db.flush()

        await AuditService.record(
            db,
            action="SERVICE_CATALOG_ITEM_CREATED",
            module="requests",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="service_catalog_item",
            target_id=str(item.id),
            outcome="success",
            detail=f"Created catalog item '{item.title}' ({item.slug}).",
            request=request,
        )
        return item

    @staticmethod
    async def list_requests(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        status: str | None = None,
        department: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_dir: Literal["asc", "desc"] = "desc",
        page: int = 1,
        page_size: int = 25,
    ) -> tuple[list[ServiceRequestOut], PageMeta]:
        await set_transaction_tenant_context(db, principal.organization_id)
        requester_only = principal.user_id if principal.portal_type == PORTAL_END_USER else None
        rows, meta = await ServiceRequestRepository.list_paginated(
            db,
            organization_id=principal.organization_id,
            requester_only_user_id=requester_only,
            status=status,
            department=department,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )
        serialized = [await ServiceRequestService._serialize(db, r) for r in rows]
        return serialized, meta

    @staticmethod
    async def get_request(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        request_id: uuid.UUID,
    ) -> ServiceRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        req = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=request_id
        )
        if req is None:
            raise NotFoundError("Service request not found.")
        if (
            principal.portal_type == PORTAL_END_USER
            and req.requester_user_id != principal.user_id
        ):
            raise AuthorizationError("End users may only access their own service requests.")
        return await ServiceRequestService._serialize(db, req)

    @staticmethod
    async def create_request(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: ServiceRequestCreateRequest,
        request: Request | None = None,
    ) -> ServiceRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)

        catalog_item: ServiceCatalogItem | None = None
        if payload.catalog_item_id is not None:
            catalog_item = await ServiceRequestRepository.get_catalog_item(
                db,
                organization_id=principal.organization_id,
                catalog_item_id=payload.catalog_item_id,
            )
            if catalog_item is None:
                raise NotFoundError("Selected service catalog item not found.")

        item_name = (
            catalog_item.title
            if catalog_item is not None
            else (payload.catalog_item_name.strip() if payload.catalog_item_name else None)
        )
        if not item_name:
            raise ValidationDomainError(
                "Either catalog_item_id or catalog_item_name is required."
            )

        cost = (
            payload.cost
            if payload.cost is not None
            else (catalog_item.price if catalog_item is not None else Decimal("0.00"))
        )
        number = await ServiceRequestRepository.next_number(db, principal.organization_id)
        now = datetime.now(timezone.utc)
        initial_status = "submitted" if payload.approval_stages else "fulfillment"
        initial_stage = 1 if payload.approval_stages else 3

        sr = ServiceRequest(
            organization_id=principal.organization_id,
            number=number,
            catalog_item_id=catalog_item.id if catalog_item else None,
            catalog_item_name=item_name,
            description=payload.description.strip(),
            requester_user_id=principal.user_id,
            requester_name=principal.full_name,
            requester_email=principal.email,
            department=payload.department.strip(),
            cost=cost,
            status=initial_status,
            current_stage=initial_stage,
            delivery_estimate_days=payload.delivery_estimate_days,
            delivery_date=now + timedelta(days=payload.delivery_estimate_days),
            custom_form_values=payload.custom_form_values,
        )
        db.add(sr)
        await db.flush()

        for stage in sorted(payload.approval_stages, key=lambda s: s.stage_order):
            approval_item = await ApprovalsService.create_approval_item(
                db,
                principal=principal,
                payload=ApprovalItemCreateRequest(
                    subject_ref=sr.number,
                    title=stage.title,
                    stage_order=stage.stage_order,
                    requester_user_id=principal.user_id,
                    assigned_approver_user_id=stage.assigned_approver_user_id,
                ),
                request=request,
            )
            db.add(
                Notification(
                    organization_id=principal.organization_id,
                    recipient_user_id=approval_item.assigned_approver_user_id,
                    category="approval",
                    title=f"Approval needed: {sr.number} ({stage.title})",
                    message=f"{principal.full_name} requested {sr.catalog_item_name}.",
                    record_type="service_request",
                    record_id=str(sr.id),
                )
            )

        db.add(
            ServiceRequestActivity(
                organization_id=principal.organization_id,
                service_request_id=sr.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                action="REQUEST_CREATED",
                detail=(
                    f"Submitted {sr.number} for '{sr.catalog_item_name}' "
                    f"with {len(payload.approval_stages)} designated approval stage(s)."
                ),
            )
        )
        await AuditService.record(
            db,
            action="SERVICE_REQUEST_CREATED",
            module="requests",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="service_request",
            target_id=str(sr.id),
            outcome="success",
            detail=f"Created service request {sr.number} ({sr.catalog_item_name}).",
            request=request,
        )
        await db.flush()
        fresh = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=sr.id
        )
        return await ServiceRequestService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def decide_stage(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        request_id: uuid.UUID,
        approval_id: uuid.UUID,
        payload: ApprovalDecisionRequest,
        request: Request | None = None,
    ) -> ServiceRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        sr = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=request_id, for_update=True
        )
        if sr is None:
            raise NotFoundError("Service request not found.")

        approval = await ApprovalsService.decide_approval_item(
            db,
            principal=principal,
            approval_id=approval_id,
            payload=payload,
            request=request,
        )
        if approval.subject_ref != sr.number:
            raise ValidationDomainError("Approval stage does not belong to the specified service request.")

        all_stages = await ServiceRequestRepository.list_approvals_for_request(
            db, organization_id=principal.organization_id, request_number=sr.number
        )
        if any(s.status == "rejected" for s in all_stages):
            sr.status = "rejected"
        elif all(s.status == "approved" for s in all_stages):
            sr.status = "fulfillment"
            sr.current_stage = max(3, len(all_stages) + 1)
        else:
            approved_count = sum(1 for s in all_stages if s.status == "approved")
            sr.status = "manager_approved" if approved_count == 1 else "security_review"
            sr.current_stage = min(4, approved_count + 1)

        db.add(
            ServiceRequestActivity(
                organization_id=principal.organization_id,
                service_request_id=sr.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                action=f"APPROVAL_{approval.status.upper()}",
                detail=(
                    f"Stage '{approval.title}' {approval.status} by {principal.email}"
                    + (" (Super Admin override)" if approval.override_used else "")
                    + "."
                ),
            )
        )
        await db.flush()
        fresh = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=sr.id
        )
        return await ServiceRequestService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def reassign_stage(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        request_id: uuid.UUID,
        approval_id: uuid.UUID,
        payload: ApprovalReassignRequest,
        request: Request | None = None,
    ) -> ServiceRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        sr = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=request_id, for_update=True
        )
        if sr is None:
            raise NotFoundError("Service request not found.")
        approval = await ApprovalsService.reassign_approval_item(
            db,
            principal=principal,
            approval_id=approval_id,
            payload=payload,
            request=request,
        )
        db.add(
            ServiceRequestActivity(
                organization_id=principal.organization_id,
                service_request_id=sr.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                action="APPROVER_REASSIGNED",
                detail=f"Stage '{approval.title}' reassigned to {approval.assigned_approver_email}.",
            )
        )
        await db.flush()
        fresh = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=sr.id
        )
        return await ServiceRequestService._serialize(db, fresh)  # type: ignore[arg-type]

    @staticmethod
    async def assign_request(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        request_id: uuid.UUID,
        payload: ServiceRequestAssignRequest,
        request: Request | None = None,
    ) -> ServiceRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        sr = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=request_id, for_update=True
        )
        if sr is None:
            raise NotFoundError("Service request not found.")

        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.user))
                .where(
                    OrganizationMembership.organization_id == principal.organization_id,
                    OrganizationMembership.user_id == payload.assignee_user_id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if membership is None or membership.user is None:
            raise NotFoundError("Assignee does not hold an active membership in this organization.")

        sr.assignee_user_id = membership.user.id
        sr.assignee_name = membership.user.full_name
        db.add(
            ServiceRequestActivity(
                organization_id=principal.organization_id,
                service_request_id=sr.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                action="REQUEST_ASSIGNED",
                detail=payload.note or f"Assigned fulfillment to {membership.user.full_name}.",
            )
        )
        await AuditService.record(
            db,
            action="SERVICE_REQUEST_ASSIGNED",
            module="requests",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="service_request",
            target_id=str(sr.id),
            outcome="success",
            detail=f"Assigned {sr.number} to {membership.user.email}.",
            request=request,
        )
        await db.flush()
        return await ServiceRequestService._serialize(db, sr)

    @staticmethod
    async def fulfill_request(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        request_id: uuid.UUID,
        payload: ServiceRequestFulfillRequest,
        request: Request | None = None,
    ) -> ServiceRequestOut:
        await set_transaction_tenant_context(db, principal.organization_id)
        sr = await ServiceRequestRepository.get_by_id(
            db, organization_id=principal.organization_id, request_id=request_id, for_update=True
        )
        if sr is None:
            raise NotFoundError("Service request not found.")
        if sr.status == "rejected":
            raise ConflictError("Rejected service requests cannot be fulfilled.")

        approvals = await ServiceRequestRepository.list_approvals_for_request(
            db, organization_id=principal.organization_id, request_number=sr.number
        )
        if approvals and not all(a.status == "approved" for a in approvals):
            raise ConflictError(
                "All designated approval stages must be approved before fulfilling this service request."
            )

        sr.fulfillment_notes = payload.fulfillment_notes.strip()
        if payload.mark_completed:
            sr.status = "completed"
            sr.current_stage = 4
            sr.completed_at = datetime.now(timezone.utc)
        else:
            sr.status = "fulfillment"
            sr.current_stage = 3

        db.add(
            ServiceRequestActivity(
                organization_id=principal.organization_id,
                service_request_id=sr.id,
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                action="REQUEST_FULFILLED" if payload.mark_completed else "FULFILLMENT_UPDATED",
                detail=sr.fulfillment_notes,
            )
        )
        await AuditService.record(
            db,
            action="SERVICE_REQUEST_FULFILLED",
            module="requests",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="service_request",
            target_id=str(sr.id),
            outcome="success",
            detail=f"Fulfilled {sr.number} (status={sr.status}).",
            request=request,
        )
        await db.flush()
        return await ServiceRequestService._serialize(db, sr)
