"""Custom /auth/register route.

Why custom: fastapi-users' built-in register router has no extension hook for
captcha verification, and we need to reject invalid tokens *before* a user row
is created. The error-translation logic mirrors fastapi_users.router.register
so the frontend error contract is unchanged.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi_users import exceptions
from fastapi_users.router.common import ErrorCode

from app.core.users import get_user_manager, UserManager
from app.models.users import UserCreate, UserCreateWithCaptcha, UserRead
from app.services.captcha import verify_hcaptcha

router = APIRouter()


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
) -> UserRead:
    remote_ip = request.client.host if request.client else None
    await verify_hcaptcha(user_create.hcaptcha_token, remote_ip=remote_ip)

    base_payload = user_create.model_dump(exclude={"hcaptcha_token"})
    try:
        created_user = await user_manager.create(
            UserCreate(**base_payload), safe=True, request=request
        )
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
