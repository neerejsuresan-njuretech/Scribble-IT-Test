from __main__ import __annotations__

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import Settings
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    TenantIsolationError,
    ValidationDomainError,
)
from app.core.permissions import (
    PORTAL_EMPLOYEE,
    PORTAL_IAM,
    PORTAL_SUPER_ADMIN,
    compute_effective_permissions,
    derive_clearance_tier,
)
from app.core.security import (
    create_access_token,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
    enforce_rate_limit,
    generate_backup_codes,
    generate_certificate_thumbprint,
    generate_opaque_token,
    generate_totp_code,
    generate_totp_secret,
    hash_password,
    hash_token,
    verify_password,
    verify_totp_code,
)
from app.core.tenant import AuthenticatedPrincipal
from app.db.models.device_trust import DeviceEnrollmentCode, ManagedDevice
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
from app.modules.audit.service import AuditService
from app.modules.organizations.service import (
    seed_organization_default_roles,
)


class AuthService:
    """Enterprise authentication, session management, IAM SSO, and device trust service."""

    @staticmethod
    async def register(
        db: AsyncSession,
        *,
        payload: Any,
        settings: Settings,
        request: Request | None = None,
    ) -> tuple[User, OrganizationMembership]:
        await enable_transaction_platform_lookup(db)

        email_norm = str(payload.email).lower().strip()
        existing_user = (
            await db.execute(select(User).where(User.email == email_norm, User.deleted_at.is_(None)))
        ).scalar_one_or_none()

        if existing_user is not None:
            raise ConflictError("An active user with this email address already exists.")

        # Determine target organization
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
        elif payload.company_name and payload.company_slug and payload.company_code:
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
            # Fallback to default enterprise organization if none provided
            org = (
                await db.execute(
                    select(Organization).where(Organization.deleted_at.is_(None)).order_by(Organization.created_at.asc()).limit(1)
                )
            ).scalar_one_or_none()
            if org is None:
                # Bootstrap initial organization if DB is completely empty
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

        # First registered user in a pristine database bootstrap becomes Super Admin
        user_count = int((await db.execute(select(User).where(User.deleted_at.is_(None)))).scalar_one())
        is_first_user = user_count == 0

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
        default_role_slug = "pol-super-admin" if is_first_user else "pol-employee-ops"
        portal = PORTAL_SUPER_ADMIN if is_first_user else PORTAL_EMPLOYEE
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
            metadata={"is_super_admin": user.is_platform_super_admin},
            request=request,
        )
        return user, membership

    @staticmethod
    async def login(
        db: AsyncSession,
        *,
        payload: Any,
        settings: Settings,
        request: Request | None = None,
    ) -> tuple[str, str, UserSession, Organization, OrganizationMembership]:
        email_norm = str(payload.email).lower().strip()
        await enforce_rate_limit(bucket="login", identifier=email_norm, max_requests=5, window_seconds=60)

        await enable_transaction_platform_lookup(db)
        user = (
            await db.execute(
                select(User).where(User.email == email_norm, User.deleted_at.is_(None))
            )
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if user is not None and user.locked_until and user.locked_until > now:
            raise AuthenticationError("Account is temporarily locked due to excessive failed login attempts.")

        if user is None or not verify_password(payload.password, user.password_hash):
            if user is not None:
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= 5:
                    user.locked_until = now + timedelta(minutes=15)
                await db.flush()
            raise AuthenticationError("Invalid email address or password.")

        # Reset failed attempts on success
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now

        # Resolve organization
        org_query = select(Organization).join(
            OrganizationMembership,
            OrganizationMembership.organization_id == Organization.id,
        ).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == "active",
            OrganizationMembership.deleted_at.is_(None),
            Organization.deleted_at.is_(None),
        )
        if payload.organization_id:
            org_query = org_query.where(Organization.id == payload.organization_id)

        memberships = list((await db.execute(org_query.options(selectinload(OrganizationMembership.roles).selectinload(Role.permissions)))).scalars().all())
        if not memberships:
            raise AuthenticationError("No active organization membership found for this user.")

        # Pick matching membership by portal_type or default
        membership = next((m for m in memberships if m.portal_type == payload.portal_type), memberships[0])
        org = (
            await db.execute(select(Organization).where(Organization.id == membership.organization_id))
        ).scalar_one()

        if org.status != "active" and not user.is_platform_super_admin:
            raise AuthorizationError("Organization workspace is currently suspended.")

        if membership.status != "active":
            raise AuthorizationError("Your membership in this organization is suspended.")

        # Check SSO-only enforcement
        role_sso_only = any(r.sso_only for r in membership.roles if r.deleted_at is None)
        if membership.sso_only or role_sso_only:
            raise AuthenticationError(
                "Password authentication is disabled for this account/role. Use Company Device SSO."
            )

        # Check MFA enforcement
        role_mfa_required = any(r.mfa_required for r in membership.roles if r.deleted_at is None)
        mfa_needed = membership.mfa_required or role_mfa_required

        if mfa_needed:
            mfa_row = (
                await db.execute(
                    select(MfaMethod).where(
                        MfaMethod.user_id == user.id,
                        MfaMethod.is_verified.is_(True),
                    )
                )
            ).scalar_one_or_none()

            if mfa_row is None:
                raise AuthenticationError("MFA enrollment is required but no verified authenticator exists.")

            if not payload.totp_code and not payload.backup_code:
                # Return partial success signalling MFA challenge required
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
                raise AuthenticationError("Invalid MFA verification code or backup code.")

        # Issue access & refresh tokens
        access_token, access_ttl = create_access_token(
            settings=settings,
            user_id=user.id,
            session_id=uuid.uuid4(),  # placeholder until session created
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
        )

        raw_refresh = generate_opaque_token(64)
        refresh_hash = hash_token(raw_refresh)
        token_family_id = uuid.uuid4()
        refresh_expires = now + timedelta(days=settings.refresh_token_ttl_days)

        session_row = UserSession(
            user_id=user.id,
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
            auth_method="password_mfa" if mfa_needed else "password",
            token_family_id=token_family_id,
            refresh_token_hash=refresh_hash,
            expires_at=refresh_expires,
            ip_address=request.client.host if request and request.client else None,
            user_agent=request.headers.get("User-Agent")[:512] if request else None,
        )
        db.add(session_row)
        await db.flush()

        # Re-generate access token with correct session_id
        access_token, _ = create_access_token(
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
            detail=f"User '{user.email}' logged in successfully via portal '{membership.portal_type}'.",
            request=request,
        )
        return access_token, raw_refresh, session_row, org, membership

    @staticmethod
    async def refresh_tokens(
        db: AsyncSession,
        *,
        raw_refresh_token: str,
        settings: Settings,
        request: Request | None = None,
    ) -> tuple[str, str, UserSession, Organization, OrganizationMembership]:
        await enforce_rate_limit(bucket="refresh", identifier="global", max_requests=30, window_seconds=60)
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

        # REUSE DETECTION: If presented token matches previous_refresh_token_hash, a replay attack is occurring!
        if session_row.previous_refresh_token_hash == presented_hash:
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
                organization_id=session_row.organization_id,
                target_type="token_family",
                target_id=str(session_row.token_family_id),
                outcome="denied",
                detail="Stale refresh token reuse detected. Revoked entire token family.",
                request=request,
            )
            raise AuthenticationError("Security alert: Refresh token reuse detected. All sessions revoked.")

        if session_row.revoked_at is not None or session_row.expires_at <= now:
            raise AuthenticationError("Refresh session has expired or been revoked.")

        user = (
            await db.execute(select(User).where(User.id == session_row.user_id, User.deleted_at.is_(None)))
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
            raise AuthenticationError("Organization membership is inactive.")

        org = (
            await db.execute(select(Organization).where(Organization.id == session_row.organization_id))
        ).scalar_one()

        # Rotate refresh token
        new_raw_refresh = generate_opaque_token(64)
        new_refresh_hash = hash_token(new_raw_refresh)

        session_row.previous_refresh_token_hash = session_row.refresh_token_hash
        session_row.refresh_token_hash = new_refresh_hash
        session_row.last_used_at = now
        session_row.expires_at = now + timedelta(days=settings.refresh_token_ttl_days)
        await db.flush()

        access_token, _ = create_access_token(
            settings=settings,
            user_id=user.id,
            session_id=session_row.id,
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
        )

        await set_transaction_tenant_context(db, org.id)
        return access_token, new_raw_refresh, session_row, org, membership

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
            detail=f"User '{principal.email}' logged out.",
            request=request,
        )

    @staticmethod
    async def enroll_mfa(
        db: AsyncSession,
        *,
        principal: AuthenticatedPrincipal,
        settings: Settings,
        request: Request | None = None,
    ):
        await enable_transaction_platform_lookup(db)
        raw_secret = generate_totp_secret()
        encrypted_secret = encrypt_mfa_secret(raw_secret, settings)
        plain_backups, hashed_backups = generate_backup_codes(8)

        # Deactivate existing unverified MFA methods for user
        await db.execute(
            update(MfaMethod)
            .where(MfaMethod.user_id == principal.user_id)
            .values(is_verified=False)
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

        otpauth_url = f"otpauth://totp/ScribbleIT:{principal.email}?secret={raw_secret}&issuer=ScribbleIT2"

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
            detail="Initiated TOTP MFA enrollment.",
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
                select(MfaMethod).where(
                    MfaMethod.user_id == principal.user_id,
                    MfaMethod.is_verified.is_(False),
                ).order_by(MfaMethod.created_at.desc()).limit(1)
            )
        ).scalar_one_or_none()

        if mfa_row is None:
            raise NotFoundError("No pending MFA enrollment found.")

        secret = decrypt_mfa_secret(mfa_row.secret_encrypted, settings)
        if not verify_totp_code(secret, code):
            raise ValidationDomainError("Invalid verification code. Ensure your authenticator app is synced.")

        mfa_row.is_verified = True
        mfa_row.last_used_at = datetime.now(timezone.utc)
        await db.flush()

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
            detail="Successfully verified and enabled TOTP MFA.",
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
        Redeems an IAM-portal-generated single-use device enrollment verification code (IAM-XXXX-XXXX)
        to onboard a new company-managed device.
        """
        await enable_transaction_platform_lookup(db)
        code_hash = hash_token(payload.enrollment_code.strip())
        now = datetime.now(timezone.utc)

        enroll_code = (
            await db.execute(
                select(DeviceEnrollmentCode).where(
                    DeviceEnrollmentCode.organization_id == principal.organization_id,
                    DeviceEnrollmentCode.code_hash == code_hash,
                    DeviceEnrollmentCode.status == "active",
                )
            )
        ).scalar_one_or_none()

        if enroll_code is None or enroll_code.expires_at <= now:
            raise ValidationDomainError("Invalid, expired, or already redeemed device enrollment code.")

        if enroll_code.assigned_email and enroll_code.assigned_email.lower() != principal.email.lower():
            raise AuthorizationError("This enrollment code was assigned to a different user email.")

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
            if existing_device.status == "revoked":
                existing_device.status = "active"
                existing_device.revoked_at = None
                existing_device.revoked_by_user_id = None
            existing_device.certificate_thumbprint = thumbprint
            existing_device.bound_user_id = principal.user_id
            existing_device.last_seen_at = now
            device = existing_device
        else:
            device = ManagedDevice(
                organization_id=principal.organization_id,
                device_fingerprint_hash=fp_hash,
                hostname=payload.hostname.strip(),
                os_platform=payload.os_platform.strip(),
                certificate_thumbprint=thumbprint,
                bound_user_id=principal.user_id,
                enrolled_by_email=principal.email,
                enrollment_code_id=enroll_code.id,
                verified_by_iam=True,
                status="active",
                last_seen_at=now,
            )
            db.add(device)

        enroll_code.status = "used"
        enroll_code.used_at = now
        enroll_code.used_by_device_id = device.id
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
            detail=f"Successfully onboarded managed device '{device.hostname}' via verification code.",
            metadata={"hostname": device.hostname, "thumbprint": thumbprint},
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
    ) -> tuple[str, str, UserSession, Organization, OrganizationMembership]:
        """
        Company Device SSO login. Verifies active IAM-managed device fingerprint and
        certificate thumbprint. Bypasses standard password checks and permits login
        even when sso_only=True.
        """
        await enforce_rate_limit(bucket="device_sso", identifier=payload.email, max_requests=5, window_seconds=60)
        await enable_transaction_platform_lookup(db)

        email_norm = str(payload.email).lower().strip()
        fp_hash = hash_token(payload.device_fingerprint.strip())

        device = (
            await db.execute(
                select(ManagedDevice).where(
                    ManagedDevice.organization_id == payload.organization_id,
                    ManagedDevice.device_fingerprint_hash == fp_hash,
                    ManagedDevice.certificate_thumbprint == payload.certificate_thumbprint.strip().upper(),
                    ManagedDevice.status == "active",
                )
            )
        ).scalar_one_or_none()

        if device is None:
            raise AuthenticationError("Company Device SSO denied: Device is not recognized, unmanaged, or revoked.")

        user = (
            await db.execute(select(User).where(User.email == email_norm, User.deleted_at.is_(None)))
        ).scalar_one_or_none()
        if user is None or user.status != "active":
            raise AuthenticationError("User account is inactive or suspended.")

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
            await db.execute(select(Organization).where(Organization.id == payload.organization_id))
        ).scalar_one()

        device.last_seen_at = datetime.now(timezone.utc)
        if device.bound_user_id is None:
            device.bound_user_id = user.id

        now = datetime.now(timezone.utc)
        access_token, _ = create_access_token(
            settings=settings,
            user_id=user.id,
            session_id=uuid.uuid4(),
            organization_id=org.id,
            membership_id=membership.id,
            portal_type=membership.portal_type,
        )

        raw_refresh = generate_opaque_token(64)
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
            device_id=device.id,
            ip_address=request.client.host if request and request.client else None,
            user_agent=request.headers.get("User-Agent")[:512] if request else None,
        )
        db.add(session_row)
        await db.flush()

        access_token, _ = create_access_token(
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
            action="DEVICE_SSO_LOGIN_SUCCESS",
            module="auth",
            actor_email=user.email,
            actor_user_id=user.id,
            organization_id=org.id,
            portal_type=membership.portal_type,
            target_type="managed_device",
            target_id=str(device.id),
            outcome="success",
            detail=f"User '{user.email}' authenticated successfully via Company Device SSO.",
            request=request,
        )
        return access_token, raw_refresh, session_row, org, membership
