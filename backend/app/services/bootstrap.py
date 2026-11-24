"""First-administrator bootstrap from operator-controlled environment variables.

An administrator is never granted because an account's email matches
configuration. Only when no superuser exists, and both FIRST_ADMIN_EMAIL and
FIRST_ADMIN_PASSWORD are set, the server itself creates that account, or
promotes an existing one whose stored password hash matches
FIRST_ADMIN_PASSWORD (which only the operator knows).
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


async def bootstrap_first_admin() -> str:
    """Return "skipped", "exists", "created", "promoted" or "refused" (for tests)."""
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
                "was created. Email matching no longer grants admin rights."
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
        user_manager = UserManager(user_db)

        user = await user_db.get_by_email(email)  # case-insensitive
        if user is None:
            try:
                user = await user_manager.create(
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
                # A concurrent registration or another replica won the race.
                await session.rollback()
                user = await user_db.get_by_email(email)
                if user is None:
                    raise
            else:
                user.role = "admin"
                await session.commit()
                logger.warning(
                    "Created first administrator %s. Remove FIRST_ADMIN_PASSWORD from the environment.",
                    email,
                )
                return "created"

        if user.is_superuser:
            return "exists"  # a peer created/promoted it in the meantime

        verified, _ = user_manager.password_helper.verify_and_update(password, user.hashed_password)
        if not verified:
            logger.error(
                "An account with FIRST_ADMIN_EMAIL already exists and FIRST_ADMIN_PASSWORD does "
                "not match it; it was NOT promoted. Use a different FIRST_ADMIN_EMAIL."
            )
            return "refused"

        user.is_superuser = True
        user.is_active = True
        user.role = "admin"
        await session.commit()
        logger.warning(
            "Promoted existing account %s to administrator. Remove FIRST_ADMIN_PASSWORD "
            "from the environment.",
            user.email,
        )
        return "promoted"
