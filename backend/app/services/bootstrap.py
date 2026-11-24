"""First-administrator bootstrap from operator-controlled environment variables.

Only when no superuser exists, and both FIRST_ADMIN_EMAIL and
FIRST_ADMIN_PASSWORD are set, the server itself creates a NEW account as the
first administrator. It never promotes or activates an existing account: if
the configured email already belongs to an account (for example one created
through public registration), bootstrap is refused and an error is logged.

Once any superuser exists this is a no-op, so restarts never promote anyone
and bootstrap never reopens. To recover a deactivated or lost sole
administrator, use the documented SQL path (user manual, "Bootstrapping the
First Admin", Path B).
"""
from __future__ import annotations

import logging
import os

from fastapi_users import exceptions
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError

from app.core.users import UserManager
from app.database.db import User, async_session_maker
from app.models.users import UserCreate

logger = logging.getLogger(__name__)

MIN_PASSWORD_LENGTH = 12

_EXISTING_ACCOUNT_MESSAGE = (
    "FIRST_ADMIN_EMAIL %s already belongs to an account, so no administrator was created. "
    "Bootstrap only creates a new account and never promotes an existing one. "
    "Set FIRST_ADMIN_EMAIL to an address that has no account and restart, or promote the "
    "account manually with SQL (user manual: Bootstrapping the First Admin, Path B)."
)


async def bootstrap_first_admin() -> str:
    """Return "skipped", "exists", "created" or "refused" (for tests; lifespan ignores it)."""
    email = os.getenv("FIRST_ADMIN_EMAIL", "").strip()
    password = os.getenv("FIRST_ADMIN_PASSWORD", "")

    async with async_session_maker() as session:
        superuser_exists = (
            await session.execute(select(exists().where(User.is_superuser.is_(True))))
        ).scalar()
        if superuser_exists:
            if email or password:
                logger.warning(
                    "A superuser already exists; FIRST_ADMIN_EMAIL/FIRST_ADMIN_PASSWORD "
                    "are ignored and can be removed."
                )
            return "exists"

        if not email:
            return "skipped"
        if not password:
            logger.error(
                "FIRST_ADMIN_EMAIL is set but FIRST_ADMIN_PASSWORD is not; no administrator "
                "was created. Set both to create the first administrator."
            )
            return "skipped"
        if len(password) < MIN_PASSWORD_LENGTH or password.lower() == email.lower():
            logger.error(
                "FIRST_ADMIN_PASSWORD is too weak (at least %d characters, and not the email "
                "address); no administrator was created.",
                MIN_PASSWORD_LENGTH,
            )
            return "refused"

        user_db = SQLAlchemyUserDatabase(session, User)
        if await user_db.get_by_email(email) is not None:  # case-insensitive
            logger.error(_EXISTING_ACCOUNT_MESSAGE, email)
            return "refused"

        try:
            user = await UserManager(user_db).create(
                UserCreate(
                    email=email,
                    password=password,
                    is_active=True,
                    is_superuser=True,
                    is_verified=True,
                ),
                safe=False,
            )
        except (exceptions.UserAlreadyExists, IntegrityError):
            # Lost a race on the unique email index: either a peer replica created
            # the administrator (fine) or a public registration took the address
            # first (refuse; that account is never touched).
            await session.rollback()
            existing = await user_db.get_by_email(email)
            if existing is None:
                raise
            if existing.is_superuser:
                return "exists"
            logger.error(_EXISTING_ACCOUNT_MESSAGE, email)
            return "refused"

        user.role = "admin"
        await session.commit()
        logger.warning(
            "Created first administrator %s. Remove FIRST_ADMIN_PASSWORD from the environment.",
            email,
        )
        return "created"
