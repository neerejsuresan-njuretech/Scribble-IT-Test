from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PaginatedResponse
from app.core.tenant import AuthenticatedPrincipal, require_any_permission, require_permissions
from app.db.session import get_db_session
from app.modules.cmdb.repository import CmdbRepository
from app.modules.cmdb.schemas import (
    AssetAssignRequest,
    AssetCreateRequest,
    AssetOut,
    AssetUpdateRequest,
    CmdbRelationCreateRequest,
    CmdbRelationOut,
    ContractCreateRequest,
    ContractOut,
    DomainRecordCreateRequest,
    DomainRecordOut,
    InventoryAdjustRequest,
    InventoryItemCreateRequest,
    InventoryItemOut,
    SoftwareLicenseCreateRequest,
    SoftwareLicenseOut,
    SoftwareSeatsAdjustRequest,
)
from app.modules.cmdb.service import CmdbService

router = APIRouter(tags=["CMDB & Assets"])


@router.get("/assets", response_model=PaginatedResponse[AssetOut])
async def list_assets(
    status_filter: str | None = Query(default=None, alias="status"),
    asset_type: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=200),
    sort_by: str | None = Query(default="created_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:read")),
    db: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[AssetOut]:
    rows, meta = await CmdbService.list_assets(
        db,
        principal=principal,
        status=status_filter,
        asset_type=asset_type,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[AssetOut](
        items=[AssetOut.model_validate(r) for r in rows], meta=meta
    )


@router.post("/assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(
    payload: AssetCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> AssetOut:
    row = await CmdbService.create_asset(
        db, principal=principal, payload=payload, request=request
    )
    return AssetOut.model_validate(row)


@router.patch("/assets/{asset_id}", response_model=AssetOut)
async def update_asset(
    asset_id: uuid.UUID,
    payload: AssetUpdateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> AssetOut:
    row = await CmdbService.update_asset(
        db, principal=principal, asset_id=asset_id, payload=payload, request=request
    )
    return AssetOut.model_validate(row)


@router.post("/assets/{asset_id}/assign", response_model=AssetOut)
async def assign_asset(
    asset_id: uuid.UUID,
    payload: AssetAssignRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> AssetOut:
    row = await CmdbService.assign_asset(
        db, principal=principal, asset_id=asset_id, payload=payload, request=request
    )
    return AssetOut.model_validate(row)


@router.get("/cmdb/relations", response_model=list[CmdbRelationOut])
async def list_cmdb_relations(
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[CmdbRelationOut]:
    rows = await CmdbRepository.list_relations(
        db, organization_id=principal.organization_id
    )
    return [CmdbRelationOut.model_validate(r) for r in rows]


@router.post("/cmdb/relations", response_model=CmdbRelationOut, status_code=status.HTTP_201_CREATED)
async def create_cmdb_relation(
    payload: CmdbRelationCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> CmdbRelationOut:
    row = await CmdbService.create_cmdb_relation(
        db, principal=principal, payload=payload, request=request
    )
    return CmdbRelationOut.model_validate(row)


@router.delete("/cmdb/relations/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cmdb_relation(
    relation_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await CmdbService.delete_cmdb_relation(
        db, principal=principal, relation_id=relation_id
    )


@router.get("/inventory", response_model=list[InventoryItemOut])
async def list_inventory(
    low_stock_only: bool = Query(default=False),
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> list[InventoryItemOut]:
    rows = await CmdbRepository.list_inventory(
        db, organization_id=principal.organization_id, low_stock_only=low_stock_only
    )
    return [InventoryItemOut.model_validate(r) for r in rows]


@router.post("/inventory", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryItemCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> InventoryItemOut:
    row = await CmdbService.create_inventory_item(
        db, principal=principal, payload=payload, request=request
    )
    return InventoryItemOut.model_validate(row)


@router.post("/inventory/{item_id}/adjust", response_model=InventoryItemOut)
async def adjust_inventory(
    item_id: uuid.UUID,
    payload: InventoryAdjustRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> InventoryItemOut:
    row = await CmdbService.adjust_inventory(
        db, principal=principal, item_id=item_id, payload=payload, request=request
    )
    return InventoryItemOut.model_validate(row)


@router.get("/software-licenses", response_model=list[SoftwareLicenseOut])
async def list_software_licenses(
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:read")),
    db: AsyncSession = Depends(get_db_session),
) -> list[SoftwareLicenseOut]:
    rows = await CmdbRepository.list_software(
        db, organization_id=principal.organization_id
    )
    return [SoftwareLicenseOut.model_validate(r) for r in rows]


@router.post(
    "/software-licenses",
    response_model=SoftwareLicenseOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_software_license(
    payload: SoftwareLicenseCreateRequest,
    request: Request,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> SoftwareLicenseOut:
    row = await CmdbService.create_software_license(
        db, principal=principal, payload=payload, request=request
    )
    return SoftwareLicenseOut.model_validate(row)


@router.post("/software-licenses/{license_id}/adjust-seats", response_model=SoftwareLicenseOut)
async def adjust_software_seats(
    license_id: uuid.UUID,
    payload: SoftwareSeatsAdjustRequest,
    principal: AuthenticatedPrincipal = Depends(require_permissions("assets:write")),
    db: AsyncSession = Depends(get_db_session),
) -> SoftwareLicenseOut:
    row = await CmdbService.adjust_software_seats(
        db, principal=principal, license_id=license_id, payload=payload
    )
    return SoftwareLicenseOut.model_validate(row)


@router.get("/contracts", response_model=list[ContractOut])
async def list_contracts(
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("assets:write", "billing:read")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> list[ContractOut]:
    rows = await CmdbRepository.list_contracts(
        db, organization_id=principal.organization_id
    )
    return [ContractOut.model_validate(r) for r in rows]


@router.post("/contracts", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(
    payload: ContractCreateRequest,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("assets:write", "billing:read")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> ContractOut:
    row = await CmdbService.create_contract(db, principal=principal, payload=payload)
    return ContractOut.model_validate(row)


@router.get("/domains", response_model=list[DomainRecordOut])
async def list_domains(
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("assets:read", "iam:manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> list[DomainRecordOut]:
    rows = await CmdbRepository.list_domains(
        db, organization_id=principal.organization_id
    )
    return [DomainRecordOut.model_validate(r) for r in rows]


@router.post("/domains", response_model=DomainRecordOut, status_code=status.HTTP_201_CREATED)
async def create_domain(
    payload: DomainRecordCreateRequest,
    principal: AuthenticatedPrincipal = Depends(
        require_any_permission("assets:write", "iam:manage")
    ),
    db: AsyncSession = Depends(get_db_session),
) -> DomainRecordOut:
    row = await CmdbService.create_domain(db, principal=principal, payload=payload)
    return DomainRecordOut.model_validate(row)
