from __future__ import annotations

import math
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Select, asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationDomainError

T = TypeVar("T")


class PageMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    has_next: bool
    has_prev: bool


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    meta: PageMeta


def build_page_meta(*, page: int, page_size: int, total: int) -> PageMeta:
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    return PageMeta(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


def apply_sorting(
    stmt: Select[Any],
    *,
    sort_by: str | None,
    sort_dir: Literal["asc", "desc"],
    allowed_columns: dict[str, Any],
    default_sort: str,
) -> Select[Any]:
    """Apply validated allowlisted sorting to prevent arbitrary column injection."""
    target_key = sort_by or default_sort
    if target_key not in allowed_columns:
        allowed_list = ", ".join(sorted(allowed_columns.keys()))
        raise ValidationDomainError(
            f"Unsupported sort_by column '{target_key}'. Allowed values: {allowed_list}."
        )
    column = allowed_columns[target_key]
    order_clause = asc(column) if sort_dir == "asc" else desc(column)
    return stmt.order_by(order_clause)


async def paginate_scalars(
    db: AsyncSession,
    stmt: Select[Any],
    *,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Any], PageMeta]:
    """Execute a count query + paginated slice safely within the active RLS transaction."""
    safe_page = max(1, page)
    safe_size = min(200, max(1, page_size))

    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int((await db.execute(count_stmt)).scalar_one())

    offset = (safe_page - 1) * safe_size
    rows = list((await db.execute(stmt.offset(offset).limit(safe_size))).scalars().all())
    meta = build_page_meta(page=safe_page, page_size=safe_size, total=total)
    return rows, meta
