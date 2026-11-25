from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationDomainError,
)
from app.core.permissions import (
    PORTAL_EMPLOYEE,
    PORTAL_SUPER_ADMIN,
    VALID_PORTALS,
)
from app.core.security import (
    create_access_token,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
    enforce_rate_limit,
    generate_backup_codes,
    generate_certificate_thumbprint,
    generate_opaque_token,
    generate_totp_secret,
    hash_password,
    hash_token,
    password_needs_rehash,
    verify_password,
    verify_totp_code,
)
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.device_trust import (
    DeviceEnrollmentCode,
    DeviceTrustEvent,
    ManagedDevice,
)
from app.db.models.identity import (
    MfaMethod,
    OrganizationMembership,
    PasswordResetToken,
    Role,
    User,
    UserSession,
)
from app.db.models.organizations import Organization
from app.db.session import (
    enable_transaction_platform_lookup,
    set_transaction_tenant_context,
)
from app.modules.audit.service import AuditService, extract_client_ip, extract_user_agent
from app.modules.organizations.service import seed_organization_default_roles


class AuthService:
    """
    Enterprise authentication, rotating refresh token families, session management,
    password reset, email verification, MFA foundations, and IAM device trust SSO.
    """

    @staticmethod
    async def register(
        db: AsyncSession,
        *,
        payload: Any,
        settings: Settings,
        request: Request | None = None,
    ) -> tuple[User, Organization, OrganizationMembership, str]:
        email_norm = str(payload.email).lower().strip()
        client_key = extract_client_ip(request) or email_norm
        await enforce_rate_limit(
            bucket="register", identifier=client_key, max_requests=10, window_seconds=300
        )

        await enable_transaction_platform_lookup(db)

        existing_user = (
            await db.execute(
                select(User).where(User.email == email_norm, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if existing_user is not None:
            raise ConflictError("An account with this email address already exists.")

        # Determine first-run platform bootstrap state (never via hardcoded email)
        active_user_count = int(
            (
                await db.execute(
                    select(func.count(User.id)).where(User.deleted_at.is_(None))
                )
            ).scalar_one()
        )
        is_first_user = active_user_count == 0

        # Resolve target organization
        org: Organization | None = None
        if payload.organization_id:
            org = (
                await db.execute(
                    select(Organization).where(
                        Organization.id == payload.organization_id,
                        Organization.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if org is None:
                raise NotFoundError("Specified organization not found.")
            if org.status != "active":
                raise AuthorizationError("Target organization is currently suspended.")
        elif payload.company_name and payload.company_slug and payload.company_code:
            if not is_first_user:
                raise AuthorizationError(
                    "Creating additional organizations requires an authenticated Super Admin Portal session."
                )
            dup_org = (
                await db.execute(
                    select(Organization).where(
                        (Organization.slug == payload.company_slug.lower())
                        | (Organization.company_code == payload.company_code.upper())
                    )
                )
            ).scalar_one_or_none()
            if dup_org is not None:
                raise ConflictError("Organization slug or company code is already registered.")
            org = Organization(
                name=payload.company_name.strip(),
                slug=payload.company_slug.lower().strip(),
                company_code=payload.company_code.upper().strip(),
                domain=email_norm.split("@")[-1],
                primary_contact_email=email_norm,
                status="active",
            )
            db.add(org)
            await db.flush()
            await seed_organization_default_roles(db, org.id)
        else:
            org = (
                await db.execute(
                    select(Organization)
                    .where(Organization.deleted_at.is_(None), Organization.status == "active")
                    .order_by(Organization.created_at.asc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if org is None:
                org = Organization(
                    name="Scribble-IT Enterprise",
                    slug="scribble-enterprise",
                    company_code="SCRIB01",
                    domain=email_norm.split("@")[-1],
                    primary_contact_email=email_norm,
                    status="active",
                )
                db.add(org)
                await db.flush()
                await seed_organization_default_roles(db, org.id)

        user = User(
            email=email_norm,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name.strip(),
            phone=payload.phone,
            job_title=payload.job_title,
            status="active",
            email_verified=False,
            is_platform_super_admin=is_first_user,
        )
        db.add(user)
        await db.flush()

        roles_dict = await seed_organization_default_roles(db, org.id)
        portal = PORTAL_SUPER_ADMIN if is_first_user else PORTAL_EMPLOYEE
        default_role_slug = "pol-super-admin" if is_first_user else "pol-employee-ops"
        assigned_role = roles_dict.get(default_role_slug)

        membership = OrganizationMembership(
            organization_id=org.id,
            user_id=user.id,
            portal_type=portal,
            clearance_tier="super_admin" if is_first_user else "it_operations",
            status="active",
            sso_only=False,
            mfa_required=is_first_user,
            is_default=True,
            roles=[assigned_role] if assigned_role is not None else [],
        )
        db.add(membership)
        await db.flush()

        # Issue single-use hashed email verification token
        raw_verify_token = generate_opaque_token(32)
        verify_row = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_verify_token),
            purpose="email_verification",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
            metadata_json={"email": user.email},
        )
        db.add(verify_row)
        await db.flush()

        await AuditService.record(
            db,
            action="USER_REGISTERED",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            organization_id=org.id,
            portal_type=portal,
            target_type="user",
            target_id=str(user.id),
            outcome="success",
            detail=f"Registered user '{user.email}' in organization '{org.name}'.",
            metadata={"bootstrap_super_admin": is_first_user},
            request=request,
        )
        return user, org, membership, raw_verify_token

    @staticmethod
    async def login(
        db: AsyncSession,
        *,
        payload: Any,
        settings: Settings,
        request: Request | None = None,
    ) -> tuple[str, str, int, UserSession, Organization, OrganizationMembership, User, bool]:
        email_norm = str(payload.email).lower().strip()
        portal_requested = str(payload.portal_type or PORTAL_EMPLOYEE).strip().lower()
        if portal_requested not in VALID_PORTALS:
            raise ValidationDomainError(f"Unsupported portal_type '{portal_requested}'.")

        await enforce_rate_limit(
            bucket="login", identifier=email_norm, max_requests=10, window_seconds=60
        )

        await enable_transaction_platform_lookup(db)
        user = (
            await db.execute(
                select(User).where(User.email == email_norm, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if user is not None and user.status != "active":
            await AuditService.record(
                db,
                action="USER_LOGIN_DENIED_SUSPENDED",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                portal_type=portal_requested,
                target_type="user",
                target_id=str(user.id),
                outcome="denied",
                detail="Blocked login attempt for suspended or inactive user account.",
                request=request,
            )
            raise AuthenticationError("User account is suspended or inactive.")

        if user is not None and user.locked_until and user.locked_until > now:
            await AuditService.record(
                db,
                action="USER_LOGIN_LOCKED",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                portal_type=portal_requested,
                target_type="user",
                target_id=str(user.id),
                outcome="denied",
                detail="Blocked login attempt while account lockout is active.",
                request=request,
            )
            raise AuthenticationError(
                "Account is temporarily locked due to repeated failed login attempts."
            )

        if user is None or not verify_password(payload.password, user.password_hash):
            if user is not None:
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= 5:
                    user.locked_until = now + timedelta(minutes=15)
                await db.flush()
            await AuditService.record(
                db,
                action="USER_LOGIN_FAILED",
                module="auth",
                actor_email=email_norm,
                actor_user_id=user.id if user is not None else None,
                portal_type=portal_requested,
                target_type="user",
                target_id=str(user.id) if user is not None else None,
                outcome="failure",
                detail="Invalid email or password presented during login.",
                request=request,
            )
            raise AuthenticationError("Invalid email address or password.")

        # Transparently rehash password if Argon2id parameters were strengthened
        if password_needs_rehash(user.password_hash):
            user.password_hash = hash_password(payload.password)

        # Fetch all active memberships with eager-loaded roles + permissions
        mem_query = (
            select(OrganizationMembership)
            .join(Organization, Organization.id == OrganizationMembership.organization_id)
            .options(selectinload(OrganizationMembership.roles).selectinload(Role.permissions))
            .where(
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.deleted_at.is_(None),
                Organization.deleted_at.is_(None),
            )
        )
        if payload.organization_id:
            mem_query = mem_query.where(Organization.id == payload.organization_id)

        all_memberships = list((await db.execute(mem_query)).scalars().all())
        active_memberships = [m for m in all_memberships if m.status == "active"]

        if not active_memberships:
            await AuditService.record(
                db,
                action="USER_LOGIN_DENIED_MEMBERSHIP",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                organization_id=payload.organization_id,
                portal_type=portal_requested,
                target_type="user",
                target_id=str(user.id),
                outcome="denied",
                detail="No active organization membership exists for user.",
                request=request,
            )
            raise AuthenticationError("No active organization membership found for this user.")

        # Enforce strict portal authorization — never let a user silently cross into a higher portal
        matching_portal = [m for m in active_memberships if m.portal_type == portal_requested]
        if not matching_portal:
            await AuditService.record(
                db,
                action="USER_LOGIN_PORTAL_DENIED",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                organization_id=active_memberships[0].organization_id,
                portal_type=portal_requested,
                target_type="user",
                target_id=str(user.id),
                outcome="denied",
                detail=f"User attempted login to unauthorized portal '{portal_requested}'.",
                request=request,
            )
            raise AuthorizationError(
                f"Your account does not hold access clearance for the '{portal_requested}' portal."
            )

        membership = next((m for m in matching_portal if m.is_default), matching_portal[0])

        if portal_requested == PORTAL_SUPER_ADMIN and not user.is_platform_super_admin:
            raise AuthorizationError("Super Admin Portal login requires platform Super Admin clearance.")

        org = (
            await db.execute(select(Organization).where(Organization.id == membership.organization_id))
        ).scalar_one()

        if org.status != "active" and not (
            user.is_platform_super_admin and portal_requested == PORTAL_SUPER_ADMIN
        ):
            await AuditService.record(
                db,
                action="USER_LOGIN_DENIED_ORG_SUSPENDED",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                organization_id=org.id,
                portal_type=portal_requested,
                target_type="organization",
                target_id=str(org.id),
                outcome="denied",
                detail="Blocked login into suspended organization workspace.",
                request=request,
            )
            raise AuthorizationError("Organization workspace is currently suspended.")

        # Enforce SSO-only policy (password login strictly forbidden when sso_only is active)
        role_sso_only = any(r.sso_only for r in membership.roles if r.deleted_at is None)
        if membership.sso_only or role_sso_only:
            await AuditService.record(
                db,
                action="USER_LOGIN_BLOCKED_SSO_ONLY",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                organization_id=org.id,
                portal_type=membership.portal_type,
                target_type="user",
                target_id=str(user.id),
                outcome="denied",
                detail="Password login blocked because SSO-only policy is enforced for this account/role.",
                request=request,
            )
            raise AuthenticationError(
                "Password authentication is disabled for this account or role. Use Company Device SSO."
            )

        # Enforce MFA whenever a verified MFA authenticator is enrolled
        mfa_row = (
            await db.execute(
                select(MfaMethod).where(
                    MfaMethod.user_id == user.id,
                    MfaMethod.is_verified.is_(True),
                )
            )
        ).scalar_one_or_none()
        mfa_enrolled = mfa_row is not None

        if mfa_row is not None:
            if not payload.totp_code and not payload.backup_code:
                raise AuthenticationError("MFA verification code is required.")

            verified_mfa = False
            if payload.totp_code:
                secret = decrypt_mfa_secret(mfa_row.secret_encrypted, settings)
                if verify_totp_code(secret, payload.totp_code):
                    verified_mfa = True
                    mfa_row.last_used_at = now
            elif payload.backup_code:
                hashed_input = hash_token(payload.backup_code.strip())
                backup_list = list(mfa_row.backup_code_hashes)
                if hashed_input in backup_list:
                    backup_list.remove(hashed_input)
                    mfa_row.backup_code_hashes = backup_list
                    verified_mfa = True
                    mfa_row.last_used_at = now

            if not verified_mfa:
                await AuditService.record(
                    db,
                    action="USER_LOGIN_MFA_FAILED",
                    module="auth",
                    actor_email=user.email,
                    actor_user_id=user.id,
                    organization_id=org.id,
                    portal_type=membership.portal_type,
                    target_type="user",
                    target_id=str(user.id),
                    outcome="failure",
                    detail="Invalid MFA TOTP or backup code during login.",
                    request=request,
                )
                raise AuthenticationError("Invalid MFA verification code or backup code.")

        # Reset brute-force counters after full credential verification
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now

        raw_refresh = generate_opaque_token(48)
        refresh_hash = hash_token(raw_refresh)
        token_family_id = uuid.uuid4()
        refresh_expires = now + timedelta(days=settings.refresh_token_ttl_days)

        session_row = UserSession(
            user_id=user.id,
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
            auth_method="password_mfa" if mfa_enrolled else "password",
            token_family_id=token_family_id,
            refresh_token_hash=refresh_hash,
            expires_at=refresh_expires,
            last_used_at=now,
            ip_address=extract_client_ip(request),
            user_agent=extract_user_agent(request),
        )
        db.add(session_row)
        await db.flush()

        access_token, access_ttl = create_access_token(
            settings=settings,
            user_id=user.id,
            session_id=session_row.id,
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
        )

        await set_transaction_tenant_context(db, org.id)
        await AuditService.record(
            db,
            action="USER_LOGIN_SUCCESS",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            organization_id=org.id,
            portal_type=membership.portal_type,
            target_type="session",
            target_id=str(session_row.id),
            outcome="success",
            detail=f"Authenticated '{user.email}' into '{membership.portal_type}' portal.",
            metadata={"auth_method": session_row.auth_method},
            request=request,
        )
        return access_token, raw_refresh, access_ttl, session_row, org, membership, user, mfa_enrolled

    @staticmethod
    async def refresh_tokens(
        db: AsyncSession,
        *,
        raw_refresh_token: str,
        settings: Settings,
        request: Request | None = None,
    ) -> tuple[str, str, int, UserSession, Organization, OrganizationMembership, User, bool]:
        client_id = extract_client_ip(request) or "anonymous"
        await enforce_rate_limit(
            bucket="refresh", identifier=client_id, max_requests=30, window_seconds=60
        )
        await enable_transaction_platform_lookup(db)

        presented_hash = hash_token(raw_refresh_token)
        now = datetime.now(timezone.utc)

        session_row = (
            await db.execute(
                select(UserSession).where(
                    (UserSession.refresh_token_hash == presented_hash)
                    | (UserSession.previous_refresh_token_hash == presented_hash)
                )
            )
        ).scalar_one_or_none()

        if session_row is None:
            raise AuthenticationError("Invalid or unknown refresh token.")

        # REFRESH-TOKEN REUSE DETECTION:
        # Presenting a previously rotated refresh token (or an already-revoked family token)
        # immediately revokes the ENTIRE token family and emits a critical security audit event.
        if session_row.previous_refresh_token_hash == presented_hash or (
            session_row.revoked_at is not None
            and session_row.revocation_reason in {"refresh_token_reuse_detected", "token_family_compromised"}
        ):
            session_row.revoked_at = now
            session_row.revocation_reason = "refresh_token_reuse_detected"
            await db.execute(
                update(UserSession)
                .where(
                    UserSession.token_family_id == session_row.token_family_id,
                    UserSession.revoked_at.is_(None),
                )
                .values(revoked_at=now, revocation_reason="token_family_compromised")
            )
            await db.flush()
            await AuditService.record(
                db,
                action="REFRESH_TOKEN_REUSE_DETECTED",
                module="security",
                actor_email="system",
                actor_user_id=session_row.user_id,
                organization_id=session_row.organization_id,
                portal_type=session_row.portal_type,
                target_type="token_family",
                target_id=str(session_row.token_family_id),
                outcome="denied",
                detail="Replayed or rotated refresh token detected. Revoked entire session token family.",
                request=request,
            )
            raise AuthenticationError(
                "Security alert: Refresh token reuse detected. All sessions in this family have been revoked."
            )

        if session_row.revoked_at is not None or session_row.expires_at <= now:
            raise AuthenticationError("Refresh session has expired or been revoked.")

        user = (
            await db.execute(
                select(User).where(User.id == session_row.user_id, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if user is None or user.status != "active":
            raise AuthenticationError("User account is inactive or suspended.")

        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.roles).selectinload(Role.permissions))
                .where(
                    OrganizationMembership.id == session_row.membership_id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if membership is None:
            raise AuthenticationError("Organization membership is inactive or suspended.")

        org = (
            await db.execute(
                select(Organization).where(
                    Organization.id == session_row.organization_id,
                    Organization.deleted_at.is_(None),
                )
            )
        ).scalar_one()
        if org.status != "active" and not (
            user.is_platform_super_admin and session_row.portal_type == PORTAL_SUPER_ADMIN
        ):
            raise AuthorizationError("Organization workspace is currently suspended.")

        # Rotate refresh token (store previous hash to detect replay)
        new_raw_refresh = generate_opaque_token(48)
        new_refresh_hash = hash_token(new_raw_refresh)

        session_row.previous_refresh_token_hash = session_row.refresh_token_hash
        session_row.refresh_token_hash = new_refresh_hash
        session_row.last_used_at = now
        session_row.expires_at = now + timedelta(days=settings.refresh_token_ttl_days)
        await db.flush()

        access_token, access_ttl = create_access_token(
            settings=settings,
            user_id=user.id,
            session_id=session_row.id,
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=session_row.portal_type,
        )

        mfa_enrolled = (
            await db.execute(
                select(func.count(MfaMethod.id)).where(
                    MfaMethod.user_id == user.id,
                    MfaMethod.is_verified.is_(True),
                )
            )
        ).scalar_one() > 0

        await set_transaction_tenant_context(db, org.id)
        await AuditService.record(
            db,
            action="SESSION_TOKEN_ROTATED",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            organization_id=org.id,
            portal_type=session_row.portal_type,
            target_type="session",
            target_id=str(session_row.id),
            outcome="success",
            detail="Rotated refresh token and issued fresh short-lived access token.",
            request=request,
        )
        return access_token, new_raw_refresh, access_ttl, session_row, org, membership, user, mfa_enrolled

    @staticmethod
    async def logout(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        request: Request | None = None,
    ) -> None:
        await enable_transaction_platform_lookup(db)
        now = datetime.now(timezone.utc)
        await db.execute(
            update(UserSession)
            .where(UserSession.id == principal.session_id)
            .values(revoked_at=now, revocation_reason="user_logout")
        )
        await set_transaction_tenant_context(db, principal.organization_id)
        await AuditService.record(
            db,
            action="USER_LOGOUT",
            module="auth",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="session",
            target_id=str(principal.session_id),
            outcome="success",
            detail=f"Revoked session on user logout for '{principal.email}'.",
            request=request,
        )

    @staticmethod
    async def list_sessions(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
    ) -> list[UserSession]:
        await enable_transaction_platform_lookup(db)
        rows = (
            await db.execute(
                select(UserSession)
                .where(UserSession.user_id == principal.user_id)
                .order_by(UserSession.created_at.desc())
            )
        ).scalars().all()
        await set_transaction_tenant_context(db, principal.organization_id)
        return list(rows)

    @staticmethod
    async def revoke_session(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        session_id: uuid.UUID,
        request: Request | None = None,
    ) -> None:
        await enable_transaction_platform_lookup(db)
        session_row = (
            await db.execute(
                select(UserSession).where(
                    UserSession.id == session_id,
                    UserSession.user_id == principal.user_id,
                )
            )
        ).scalar_one_or_none()
        if session_row is None:
            raise NotFoundError("Session not found.")

        session_row.revoked_at = datetime.now(timezone.utc)
        session_row.revocation_reason = "user_revoked_session"
        await db.flush()

        await set_transaction_tenant_context(db, principal.organization_id)
        await AuditService.record(
            db,
            action="SESSION_REVOKED",
            module="auth",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="session",
            target_id=str(session_id),
            outcome="success",
            detail=f"Revoked session {session_id}.",
            request=request,
        )

    @staticmethod
    async def revoke_all_sessions(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        keep_current: bool = False,
        request: Request | None = None,
    ) -> int:
        await enable_transaction_platform_lookup(db)
        now = datetime.now(timezone.utc)
        stmt = update(UserSession).where(
            UserSession.user_id == principal.user_id,
            UserSession.revoked_at.is_(None),
        )
        if keep_current:
            stmt = stmt.where(UserSession.id != principal.session_id)
        result = await db.execute(
            stmt.values(revoked_at=now, revocation_reason="user_revoked_all_sessions")
        )
        revoked_count = int(result.rowcount or 0)
        await set_transaction_tenant_context(db, principal.organization_id)
        await AuditService.record(
            db,
            action="ALL_SESSIONS_REVOKED",
            module="auth",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="user",
            target_id=str(principal.user_id),
            outcome="success",
            detail=f"Revoked {revoked_count} active session(s).",
            metadata={"keep_current": keep_current, "revoked_count": revoked_count},
            request=request,
        )
        return revoked_count

    @staticmethod
    async def request_password_reset(
        db: AsyncSession,
        *,
        email: str,
        settings: Settings,
        request: Request | None = None,
    ) -> str | None:
        email_norm = email.lower().strip()
        await enforce_rate_limit(
            bucket="forgot_password", identifier=email_norm, max_requests=5, window_seconds=300
        )
        await enable_transaction_platform_lookup(db)

        user = (
            await db.execute(
                select(User).where(
                    User.email == email_norm,
                    User.status == "active",
                    User.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if user is None:
            # Never disclose account existence
            return None

        raw_token = generate_opaque_token(32)
        reset_row = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            purpose="password_reset",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
            metadata_json={"requested_ip": extract_client_ip(request)},
        )
        db.add(reset_row)
        await db.flush()

        await AuditService.record(
            db,
            action="PASSWORD_RESET_REQUESTED",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            target_type="user",
            target_id=str(user.id),
            outcome="success",
            detail="Issued single-use hashed password reset token.",
            request=request,
        )
        # Only expose raw token in test/development environments for integration testing;
        # staging/production delivers strictly out-of-band via email worker.
        if settings.app_env in {"test", "development"}:
            return raw_token
        return None

    @staticmethod
    async def reset_password(
        db: AsyncSession,
        *,
        raw_token: str,
        new_password: str,
        request: Request | None = None,
    ) -> None:
        await enable_transaction_platform_lookup(db)
        now = datetime.now(timezone.utc)
        token_digest = hash_token(raw_token.strip())

        reset_row = (
            await db.execute(
                select(PasswordResetToken)
                .where(
                    PasswordResetToken.token_hash == token_digest,
                    PasswordResetToken.purpose == "password_reset",
                )
                .with_for_update()
            )
        ).scalar_one_or_none()

        if reset_row is None or reset_row.used_at is not None or reset_row.expires_at <= now:
            raise ValidationDomainError("Password reset token is invalid, expired, or already used.")

        user = (
            await db.execute(
                select(User).where(User.id == reset_row.user_id, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if user is None:
            raise NotFoundError("Associated user account not found.")

        user.password_hash = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        reset_row.used_at = now

        # Immediately invalidate ALL existing user sessions after password reset
        await db.execute(
            update(UserSession)
            .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
            .values(revoked_at=now, revocation_reason="password_reset")
        )
        await db.flush()

        await AuditService.record(
            db,
            action="PASSWORD_RESET_COMPLETED",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            target_type="user",
            target_id=str(user.id),
            outcome="success",
            detail="Password updated via Argon2id and all prior sessions revoked.",
            request=request,
        )

    @staticmethod
    async def verify_email(
        db: AsyncSession,
        *,
        raw_token: str,
        request: Request | None = None,
    ) -> User:
        await enable_transaction_platform_lookup(db)
        now = datetime.now(timezone.utc)
        token_digest = hash_token(raw_token.strip())

        token_row = (
            await db.execute(
                select(PasswordResetToken)
                .where(
                    PasswordResetToken.token_hash == token_digest,
                    PasswordResetToken.purpose == "email_verification",
                )
                .with_for_update()
            )
        ).scalar_one_or_none()

        if token_row is None or token_row.used_at is not None or token_row.expires_at <= now:
            raise ValidationDomainError("Email verification token is invalid, expired, or already used.")

        user = (
            await db.execute(
                select(User).where(User.id == token_row.user_id, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if user is None:
            raise NotFoundError("Associated user account not found.")

        user.email_verified = True
        user.email_verified_at = now
        token_row.used_at = now
        await db.flush()

        await AuditService.record(
            db,
            action="EMAIL_VERIFIED",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            target_type="user",
            target_id=str(user.id),
            outcome="success",
            detail=f"Verified email address '{user.email}'.",
            request=request,
        )
        return user

    @staticmethod
    async def enroll_mfa(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        settings: Settings,
        request: Request | None = None,
    ) -> dict[str, Any]:
        await enable_transaction_platform_lookup(db)
        raw_secret = generate_totp_secret()
        encrypted_secret = encrypt_mfa_secret(raw_secret, settings)
        plain_backups, hashed_backups = generate_backup_codes(8)

        # Invalidate prior unverified attempts
        await db.execute(
            update(MfaMethod)
            .where(MfaMethod.user_id == principal.user_id, MfaMethod.is_verified.is_(False))
            .values(is_primary=False)
        )

        mfa = MfaMethod(
            user_id=principal.user_id,
            method_type="totp",
            label="Enterprise Authenticator",
            secret_encrypted=encrypted_secret,
            backup_code_hashes=hashed_backups,
            is_verified=False,
            is_primary=True,
        )
        db.add(mfa)
        await db.flush()

        otpauth_url = f"otpauth://totp/ScribbleIT:{principal.email}?secret={raw_secret}&issuer=ScribbleIT"

        await set_transaction_tenant_context(db, principal.organization_id)
        await AuditService.record(
            db,
            action="MFA_ENROLLMENT_STARTED",
            module="auth",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="mfa_method",
            target_id=str(mfa.id),
            outcome="success",
            detail="Initiated TOTP MFA enrollment with encrypted secret and hashed backup codes.",
            request=request,
        )
        return {
            "secret": raw_secret,
            "otpauth_url": otpauth_url,
            "backup_codes": plain_backups,
        }

    @staticmethod
    async def verify_mfa_enrollment(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        code: str,
        settings: Settings,
        request: Request | None = None,
    ) -> None:
        await enable_transaction_platform_lookup(db)
        mfa_row = (
            await db.execute(
                select(MfaMethod)
                .where(
                    MfaMethod.user_id == principal.user_id,
                    MfaMethod.is_verified.is_(False),
                )
                .order_by(MfaMethod.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        if mfa_row is None:
            raise NotFoundError("No pending MFA enrollment found.")

        secret = decrypt_mfa_secret(mfa_row.secret_encrypted, settings)
        if not verify_totp_code(secret, code):
            raise ValidationDomainError("Invalid TOTP verification code.")

        mfa_row.is_verified = True
        mfa_row.last_used_at = datetime.now(timezone.utc)
        await db.flush()

        await set_transaction_tenant_context(db, principal.organization_id)
        await AuditService.record(
            db,
            action="MFA_ENROLLED_SUCCESS",
            module="auth",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="mfa_method",
            target_id=str(mfa_row.id),
            outcome="success",
            detail="Verified and activated TOTP multi-factor authentication.",
            request=request,
        )

    @staticmethod
    async def enroll_device(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        payload: Any,
        request: Request | None = None,
    ) -> ManagedDevice:
        """
        Atomically consumes an IAM-portal-issued single-use verification code (IAM-XXXX-XXXX)
        to register an employee device within the principal's verified organization.

        Security invariant:
          - Unmanaged employee devices CANNOT self-enroll without a valid active IAM code.
          - Atomic row-locked consumption guarantees single-use even under concurrent requests.
          - Browser-generated device fingerprints are recorded as `trust_level='registered_iam_code'`
            with `mdm_verified=False`, distinct from independently MDM-attested devices.
        """
        await set_transaction_tenant_context(db, principal.organization_id)
        normalized_code = payload.enrollment_code.strip().upper()
        code_hash = hash_token(normalized_code)
        now = datetime.now(timezone.utc)

        enroll_code = (
            await db.execute(
                select(DeviceEnrollmentCode)
                .where(
                    DeviceEnrollmentCode.organization_id == principal.organization_id,
                    DeviceEnrollmentCode.code_hash == code_hash,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()

        if enroll_code is None:
            await AuditService.record(
                db,
                action="DEVICE_ENROLLMENT_DENIED",
                module="iam",
                actor_email=principal.email,
                actor_user_id=principal.user_id,
                organization_id=principal.organization_id,
                portal_type=principal.portal_type,
                outcome="denied",
                detail="Rejected device enrollment attempt with unknown verification code.",
                request=request,
            )
            raise ValidationDomainError("Invalid device enrollment verification code.")

        if enroll_code.status == "used":
            await AuditService.record(
                db,
                action="DEVICE_ENROLLMENT_CODE_REUSE_BLOCKED",
                module="iam",
                actor_email=principal.email,
                actor_user_id=principal.user_id,
                organization_id=principal.organization_id,
                portal_type=principal.portal_type,
                target_type="device_enrollment_code",
                target_id=str(enroll_code.id),
                outcome="denied",
                detail="Blocked reuse of an already consumed single-use IAM enrollment code.",
                request=request,
            )
            raise ValidationDomainError("This device enrollment code has already been used.")

        if enroll_code.status == "revoked":
            await AuditService.record(
                db,
                action="DEVICE_ENROLLMENT_CODE_REVOKED_BLOCKED",
                module="iam",
                actor_email=principal.email,
                actor_user_id=principal.user_id,
                organization_id=principal.organization_id,
                portal_type=principal.portal_type,
                target_type="device_enrollment_code",
                target_id=str(enroll_code.id),
                outcome="denied",
                detail="Blocked device enrollment with a revoked IAM code.",
                request=request,
            )
            raise ValidationDomainError("This device enrollment code has been revoked by IAM.")

        if enroll_code.expires_at <= now or enroll_code.status == "expired":
            enroll_code.status = "expired"
            await db.flush()
            await AuditService.record(
                db,
                action="DEVICE_ENROLLMENT_CODE_EXPIRED",
                module="iam",
                actor_email=principal.email,
                actor_user_id=principal.user_id,
                organization_id=principal.organization_id,
                portal_type=principal.portal_type,
                target_type="device_enrollment_code",
                target_id=str(enroll_code.id),
                outcome="denied",
                detail="Blocked device enrollment with an expired IAM verification code.",
                request=request,
            )
            raise ValidationDomainError("This device enrollment verification code has expired.")

        if enroll_code.assigned_email and enroll_code.assigned_email.lower() != principal.email.lower():
            await AuditService.record(
                db,
                action="DEVICE_ENROLLMENT_EMAIL_MISMATCH",
                module="iam",
                actor_email=principal.email,
                actor_user_id=principal.user_id,
                organization_id=principal.organization_id,
                portal_type=principal.portal_type,
                target_type="device_enrollment_code",
                target_id=str(enroll_code.id),
                outcome="denied",
                detail="Blocked device enrollment because code is bound to a different employee email.",
                request=request,
            )
            raise AuthorizationError("This enrollment code is assigned to a different employee account.")

        # Atomic conditional UPDATE guarantees single-use consumption
        consume_result = await db.execute(
            update(DeviceEnrollmentCode)
            .where(
                DeviceEnrollmentCode.id == enroll_code.id,
                DeviceEnrollmentCode.status == "active",
                DeviceEnrollmentCode.expires_at > now,
            )
            .values(status="used", used_at=now)
        )
        if int(consume_result.rowcount or 0) != 1:
            raise ConflictError("Device enrollment code was already consumed concurrently.")

        fp_hash = hash_token(payload.device_fingerprint.strip())
        thumbprint = generate_certificate_thumbprint()

        existing_device = (
            await db.execute(
                select(ManagedDevice).where(
                    ManagedDevice.organization_id == principal.organization_id,
                    ManagedDevice.device_fingerprint_hash == fp_hash,
                )
            )
        ).scalar_one_or_none()

        if existing_device is not None:
            existing_device.status = "active"
            existing_device.trust_level = "registered_iam_code"
            existing_device.mdm_verified = False
            existing_device.mdm_verified_at = None
            existing_device.revoked_at = None
            existing_device.revoked_by_user_id = None
            existing_device.hostname = payload.hostname.strip()
            existing_device.os_platform = payload.os_platform.strip()
            existing_device.mdm_provider = enroll_code.mdm_provider
            existing_device.certificate_thumbprint = thumbprint
            existing_device.bound_user_id = principal.user_id
            existing_device.enrolled_by_email = principal.email
            existing_device.enrollment_code_id = enroll_code.id
            existing_device.verified_by_iam = True
            existing_device.last_seen_at = now
            device = existing_device
        else:
            device = ManagedDevice(
                organization_id=principal.organization_id,
                device_fingerprint_hash=fp_hash,
                hostname=payload.hostname.strip(),
                os_platform=payload.os_platform.strip(),
                mdm_provider=enroll_code.mdm_provider,
                certificate_thumbprint=thumbprint,
                bound_user_id=principal.user_id,
                enrolled_by_email=principal.email,
                enrollment_code_id=enroll_code.id,
                trust_level="registered_iam_code",
                verified_by_iam=True,
                mdm_verified=False,
                status="active",
                last_seen_at=now,
            )
            db.add(device)

        await db.flush()
        enroll_code.used_by_device_id = device.id

        db.add(
            DeviceTrustEvent(
                organization_id=principal.organization_id,
                device_id=device.id,
                enrollment_code_id=enroll_code.id,
                event_type="device_registered_via_iam_code",
                actor_user_id=principal.user_id,
                actor_email=principal.email,
                detail=(
                    f"Registered device '{device.hostname}' via IAM code prefix '{enroll_code.code_prefix}'. "
                    "Trust level set to registered_iam_code (pending independent MDM attestation)."
                ),
                metadata_json={
                    "hostname": device.hostname,
                    "mdm_provider": device.mdm_provider,
                    "trust_level": device.trust_level,
                    "mdm_verified": False,
                },
            )
        )
        await db.flush()

        await AuditService.record(
            db,
            action="DEVICE_ENROLLED",
            module="iam",
            actor_email=principal.email,
            actor_user_id=principal.user_id,
            organization_id=principal.organization_id,
            portal_type=principal.portal_type,
            target_type="managed_device",
            target_id=str(device.id),
            outcome="success",
            detail=f"Onboarded device '{device.hostname}' via IAM code prefix '{enroll_code.code_prefix}'.",
            metadata={
                "hostname": device.hostname,
                "mdm_provider": device.mdm_provider,
                "trust_level": device.trust_level,
            },
            request=request,
        )
        return device

    @staticmethod
    async def device_sso_login(
        db: AsyncSession,
        *,
        payload: Any,
        settings: Settings,
        request: Request | None = None,
    ) -> tuple[str, str, int, UserSession, Organization, OrganizationMembership, User, bool]:
        """
        Company Device SSO login verifying an active IAM-registered device fingerprint,
        certificate thumbprint, organization binding, and user binding.
        """
        email_norm = str(payload.email).lower().strip()
        await enforce_rate_limit(
            bucket="device_sso", identifier=email_norm, max_requests=10, window_seconds=60
        )
        await enable_transaction_platform_lookup(db)

        fp_hash = hash_token(payload.device_fingerprint.strip())
        now = datetime.now(timezone.utc)

        device = (
            await db.execute(
                select(ManagedDevice).where(
                    ManagedDevice.organization_id == payload.organization_id,
                    ManagedDevice.device_fingerprint_hash == fp_hash,
                    ManagedDevice.certificate_thumbprint == payload.certificate_thumbprint.strip().upper(),
                    ManagedDevice.status == "active",
                    ManagedDevice.verified_by_iam.is_(True),
                )
            )
        ).scalar_one_or_none()

        if device is None:
            await AuditService.record(
                db,
                action="DEVICE_SSO_LOGIN_DENIED",
                module="auth",
                actor_email=email_norm,
                organization_id=payload.organization_id,
                outcome="denied",
                detail="Company Device SSO denied: device is unmanaged, unrecognized, or revoked.",
                request=request,
            )
            raise AuthenticationError(
                "Company Device SSO denied: Device is unmanaged, unrecognized, or has been revoked."
            )

        user = (
            await db.execute(
                select(User).where(User.email == email_norm, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if user is None or user.status != "active":
            raise AuthenticationError("User account is inactive or suspended.")

        if device.bound_user_id is not None and device.bound_user_id != user.id:
            await AuditService.record(
                db,
                action="DEVICE_SSO_USER_MISMATCH",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                organization_id=payload.organization_id,
                target_type="managed_device",
                target_id=str(device.id),
                outcome="denied",
                detail="Blocked Device SSO attempt by a user not bound to this device.",
                request=request,
            )
            raise AuthenticationError("This managed device is bound to a different employee account.")

        membership = (
            await db.execute(
                select(OrganizationMembership)
                .options(selectinload(OrganizationMembership.roles).selectinload(Role.permissions))
                .where(
                    OrganizationMembership.organization_id == payload.organization_id,
                    OrganizationMembership.user_id == user.id,
                    OrganizationMembership.status == "active",
                    OrganizationMembership.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if membership is None:
            raise AuthenticationError("User has no active membership in this organization.")

        org = (
            await db.execute(
                select(Organization).where(
                    Organization.id == payload.organization_id,
                    Organization.deleted_at.is_(None),
                )
            )
        ).scalar_one()
        if org.status != "active" and not user.is_platform_super_admin:
            raise AuthorizationError("Organization workspace is currently suspended.")

        device.last_seen_at = now
        if device.bound_user_id is None:
            device.bound_user_id = user.id
        user.last_login_at = now

        raw_refresh = generate_opaque_token(48)
        refresh_hash = hash_token(raw_refresh)
        token_family_id = uuid.uuid4()
        refresh_expires = now + timedelta(days=settings.refresh_token_ttl_days)

        session_row = UserSession(
            user_id=user.id,
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
            auth_method="device_sso",
            token_family_id=token_family_id,
            refresh_token_hash=refresh_hash,
            expires_at=refresh_expires,
            last_used_at=now,
            device_id=device.id,
            ip_address=extract_client_ip(request),
            user_agent=extract_user_agent(request),
        )
        db.add(session_row)
        await db.flush()

        access_token, access_ttl = create_access_token(
            settings=settings,
            user_id=user.id,
            session_id=session_row.id,
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
        )

        mfa_enrolled = (
            await db.execute(
                select(func.count(MfaMethod.id)).where(
                    MfaMethod.user_id == user.id,
                    MfaMethod.is_verified.is_(True),
                )
            )
        ).scalar_one() > 0

        await set_transaction_tenant_context(db, org.id)
        db.add(
            DeviceTrustEvent(
                organization_id=org.id,
                device_id=device.id,
                event_type="device_sso_login",
                actor_user_id=user.id,
                actor_email=user.email,
                detail=f"Authenticated '{user.email}' via Company Device SSO ({device.trust_level}).",
                metadata_json={"session_id": str(session_row.id), "trust_level": device.trust_level},
            )
        )
        await AuditService.record(
            db,
            action="DEVICE_SSO_LOGIN_SUCCESS",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            organization_id=org.id,
            portal_type=membership.portal_type,
            target_type="managed_device",
            target_id=str(device.id),
            outcome="success",
            detail=f"User '{user.email}' authenticated via Company Device SSO.",
            metadata={"trust_level": device.trust_level, "mdm_verified": device.mdm_verified},
            request=request,
        )
        return access_token, raw_refresh, access_ttl, session_row, org, membership, user, mfa_enrolled
