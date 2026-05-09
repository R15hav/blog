"""Server-side hCaptcha verification.

Why a dedicated service: the registration route must reject suspect traffic
*before* a User row is created, and the built-in fastapi-users register router
has no extension hook for that.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

_DEFAULT_VERIFY_URL = "https://api.hcaptcha.com/siteverify"
_TRUTHY = {"true", "1", "yes"}


def _is_enabled() -> bool:
    return os.getenv("HCAPTCHA_ENABLED", "false").strip().lower() in _TRUTHY


async def verify_hcaptcha(
    token: Optional[str], *, remote_ip: Optional[str] = None
) -> None:
    """Verify an hCaptcha token. No-op when HCAPTCHA_ENABLED is falsy.

    Raises HTTPException on missing token (400), misconfiguration (500),
    failed challenge (400), or upstream/network errors (503).
    """
    if not _is_enabled():
        return

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA token missing",
        )

    secret = os.getenv("HCAPTCHA_SECRET", "").strip()
    if not secret:
        # Operator misconfiguration: enabled but no secret. Fail closed and shout.
        logger.error(
            "HCAPTCHA_ENABLED is true but HCAPTCHA_SECRET is unset; "
            "registration is blocked until this is fixed."
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CAPTCHA misconfigured",
        )

    verify_url = os.getenv("HCAPTCHA_VERIFY_URL", _DEFAULT_VERIFY_URL).strip() or _DEFAULT_VERIFY_URL
    payload: dict[str, str] = {"secret": secret, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(verify_url, data=payload)
            response.raise_for_status()
            result = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("hCaptcha verification upstream error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CAPTCHA verification unavailable",
        ) from exc

    if not result.get("success"):
        error_codes = result.get("error-codes") or []
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CAPTCHA_INVALID", "error-codes": error_codes},
        )
