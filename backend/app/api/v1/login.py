"""Custom /auth/jwt/login route with hCaptcha gating.

Why custom: fastapi-users' built-in auth router has no extension hook for
captcha verification. We need to reject suspect traffic *before* credential
authentication so attackers cannot probe for valid usernames by skipping the
captcha. Error responses mirror fastapi_users.router.auth so the frontend
error contract (LOGIN_BAD_CREDENTIALS / LOGIN_USER_NOT_VERIFIED) is unchanged.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users.authentication import Strategy
from fastapi_users.router.common import ErrorCode

from app.core.users import (
    UserManager,
    auth_backend,
    fastapi_users,
    get_user_manager,
)
from app.services.captcha import verify_hcaptcha

router = APIRouter()

# Reuse fastapi-users' active-user dependency for logout. We do not mount the
# full built-in auth router because it would create a duplicate /auth/jwt/login
# in app.routes; defining logout here keeps the route table unambiguous.
_current_user_token = fastapi_users.authenticator.current_user_token(active=True)


class OAuth2PasswordRequestFormWithCaptcha(OAuth2PasswordRequestForm):
    """OAuth2 password form extended with an optional hCaptcha token.

    The token is optional at the schema layer because verify_hcaptcha is a
    no-op when HCAPTCHA_ENABLED is falsy; when enabled it raises 400 on a
    missing token, which preserves the same flag-controlled behaviour as
    the register route.
    """

    def __init__(
        self,
        *,
        grant_type: Optional[str] = Form(default=None, pattern="password"),
        username: str = Form(),
        password: str = Form(),
        scope: str = Form(default=""),
        client_id: Optional[str] = Form(default=None),
        client_secret: Optional[str] = Form(default=None),
        hcaptcha_token: Optional[str] = Form(default=None),
    ):
        super().__init__(
            grant_type=grant_type,
            username=username,
            password=password,
            scope=scope,
            client_id=client_id,
            client_secret=client_secret,
        )
        self.hcaptcha_token = hcaptcha_token


@router.post(
    "/jwt/login",
    name="auth:jwt.login.captcha",
)
async def login(
    request: Request,
    credentials: OAuth2PasswordRequestFormWithCaptcha = Depends(),
    user_manager: UserManager = Depends(get_user_manager),
    strategy: Strategy = Depends(auth_backend.get_strategy),
):
    # Captcha runs before authenticate() so attackers cannot probe for valid
    # usernames by bypassing the gate.
    remote_ip = request.client.host if request.client else None
    await verify_hcaptcha(credentials.hcaptcha_token, remote_ip=remote_ip)

    user = await user_manager.authenticate(credentials)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorCode.LOGIN_BAD_CREDENTIALS,
        )

    response = await auth_backend.login(strategy, user)
    await user_manager.on_after_login(user, request, response)
    return response


@router.post(
    "/jwt/logout",
    name="auth:jwt.logout",
)
async def logout(
    user_token: tuple = Depends(_current_user_token),
    strategy: Strategy = Depends(auth_backend.get_strategy),
):
    user, token = user_token
    return await auth_backend.logout(strategy, user, token)
