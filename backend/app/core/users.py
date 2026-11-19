import os
import uuid
from fastapi import Depends, HTTPException, status
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
        AuthenticationBackend,
        BearerTransport,
        JWTStrategy
    )
from fastapi_users.db import SQLAlchemyUserDatabase
from app.database.db import User, get_user_db

SECRET = os.getenv("SECRET", "dev-secret-change-me")

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    # No on_after_register override: new self-registrations are already inserted
    # with is_active=False (see User.is_active in app/database/db.py), so there is
    # no second "deactivate" commit that could fail and leave an active account.

async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)

bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

def get_jwt_strategy():
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](
    get_user_manager,
    [auth_backend],
)

current_active_user = fastapi_users.current_user(active=True)
current_optional_user = fastapi_users.current_user(active=True, optional=True)


async def current_author_or_admin(user: User = Depends(current_active_user)) -> User:
    if not user.is_superuser and user.role not in ("author", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authors and admins can perform this action.",
        )
    return user