from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.iam.router import router as iam_router
from app.modules.organizations.router import router as organizations_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, tags=["Platform"])
api_v1_router.include_router(auth_router)
api_v1_router.include_router(organizations_router)
api_v1_router.include_router(iam_router)
api_v1_router.include_router(audit_router)
