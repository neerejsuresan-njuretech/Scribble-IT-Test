from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.modules.ai.router import router as ai_router
from app.modules.approvals.router import router as approvals_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.changes.router import router as changes_router
from app.modules.cmdb.router import router as cmdb_router
from app.modules.governance.router import router as governance_router
from app.modules.iam.router import router as iam_router
from app.modules.incidents.router import router as incidents_router
from app.modules.integrations.router import router as integrations_router
from app.modules.notifications.router import router as notifications_router
from app.modules.operations.router import router as operations_router
from app.modules.organizations.router import router as organizations_router
from app.modules.problems.router import router as problems_router
from app.modules.requests.router import router as requests_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, tags=["Platform"])
api_v1_router.include_router(auth_router)
api_v1_router.include_router(organizations_router)
api_v1_router.include_router(iam_router)
api_v1_router.include_router(approvals_router)
api_v1_router.include_router(governance_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(incidents_router)
api_v1_router.include_router(requests_router)
api_v1_router.include_router(problems_router)
api_v1_router.include_router(changes_router)
api_v1_router.include_router(cmdb_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(operations_router)
api_v1_router.include_router(ai_router)
api_v1_router.include_router(integrations_router)
