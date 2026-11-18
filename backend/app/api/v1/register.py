"""Custom /auth/register route.

Why custom: fastapi-users' built-in register router has no extension hook for
captcha verification, and we need to reject invalid tokens *before* a user row
is created. The error-translation logic mirrors fastapi_users.router.register
so the frontend error contract is unchanged.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi_users import exceptions
from fastapi_users.router.common import ErrorCode
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import get_user_manager, UserManager
from app.database.db import User, get_async_session
from app.models.users import UserCreate, UserCreateWithCaptcha, UserRead
from app.services.captcha import verify_hcaptcha
from app.services.site_settings import get_site_config

router = APIRouter()

REGISTRATION_CLOSED_DETAIL = "Registration is currently closed."


def _configured_first_admin_email() -> str:
    return os.getenv("FIRST_ADMIN_EMAIL", "").strip()


async def _registration_policy(session: AsyncSession, email: str) -> str | None:
    """Enforce the admin "Allow self-registration" setting.

    Returns None for an ordinary allowed registration, or the configured
    FIRST_ADMIN_EMAIL spelling when the first-admin bootstrap exception applies.
    Raises 403 otherwise.

    Bootstrap exception: while self-registration is disabled, the address in
    FIRST_ADMIN_EMAIL may still register, but only until any superuser exists.
    That keeps a closed site bootstrappable (the startup routine promotes this
    account) without reopening registration for anyone else afterwards.
    """
    config = await get_site_config(session)
    if config.allow_registration:
        return None

    first_admin = _configured_first_admin_email()
    if first_admin and email.strip().lower() == first_admin.lower():
        superuser_exists = (
            await session.execute(select(exists().where(User.is_superuser.is_(True))))
        ).scalar()
        if not superuser_exists:
            return first_admin

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REGISTRATION_CLOSED_DETAIL)


class _InsertDuplicateGuard:
    """Per-request wrapper around the user database used by UserManager.create.

    fastapi-users checks for an existing email before inserting, but two
    concurrent requests can both pass that check; the database's unique email
    index then rejects the second INSERT with an IntegrityError. Only that case
    is translated into UserAlreadyExists (the standard duplicate response).

    The wrapper overrides create() alone, so the translation covers the INSERT
    and nothing else: errors raised later (e.g. in on_after_register, after the
    row is committed) propagate unchanged. Every other attribute is delegated,
    so the fastapi-users lifecycle is untouched.
    """

    def __init__(self, user_db):
        self._user_db = user_db

    def __getattr__(self, name):
        return getattr(self._user_db, name)

    async def create(self, create_dict):
        try:
            return await self._user_db.create(create_dict)
        except IntegrityError as exc:
            session = self._user_db.session
            await session.rollback()
            email = str(create_dict.get("email", ""))
            duplicate = (
                await session.execute(
                    select(exists().where(func.lower(User.email) == email.lower()))
                )
            ).scalar()
            if duplicate:
                raise exceptions.UserAlreadyExists() from exc
            raise


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    name="register:register",
)
async def register(
    request: Request,
    user_create: UserCreateWithCaptcha,
    user_manager: UserManager = Depends(get_user_manager),
    session: AsyncSession = Depends(get_async_session),
) -> UserRead:
    # Policy first: a closed site rejects ordinary sign-ups before any captcha
    # call. Requests that pass (including the bootstrap exception) still go
    # through hCaptcha below.
    bootstrap_email = await _registration_policy(session, str(user_create.email))

    remote_ip = request.client.host if request.client else None
    await verify_hcaptcha(user_create.hcaptcha_token, remote_ip=remote_ip)

    base_payload = user_create.model_dump(exclude={"hcaptcha_token"})
    new_user = UserCreate(**base_payload)
    if bootstrap_email:
        # Store the exact configured spelling: the startup promotion matches
        # FIRST_ADMIN_EMAIL exactly, and concurrent bootstrap attempts then
        # collide on the unique email index instead of creating case variants.
        new_user.email = bootstrap_email
    user_manager.user_db = _InsertDuplicateGuard(user_manager.user_db)  # this request only
    try:
        created_user = await user_manager.create(new_user, safe=True, request=request)
    except exceptions.UserAlreadyExists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorCode.REGISTER_USER_ALREADY_EXISTS,
        )
    except exceptions.InvalidPasswordException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": ErrorCode.REGISTER_INVALID_PASSWORD,
                "reason": exc.reason,
            },
        )

    return UserRead.model_validate(created_user)
