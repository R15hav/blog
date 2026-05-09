import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import UserRead, UserUpdate
from app.models.theme import ThemeActiveResponse
from app.api.v1.articles import router as articles_router
from app.api.v1.admin import router as admin_router
from app.api.v1.profile import router as profile_router
from app.api.v1.author import router as author_router
from app.api.v1.register import router as register_router
from app.api.v1.login import router as login_router
from app.database.db import create_db_and_tables, get_async_session, async_session_maker, User
from app.core.users import fastapi_users, auth_backend
from app.services.theme import get_active_theme
from app.services.site_settings import get_site_config


async def _promote_first_admin() -> None:
    email = os.getenv("FIRST_ADMIN_EMAIL", "").strip()
    if not email:
        return
    async with async_session_maker() as session:
        await session.execute(
            update(User)
            .where(User.email == email)
            .values(is_superuser=True, is_active=True, role="admin")
        )
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    await _promote_first_admin()
    yield


app = FastAPI(lifespan=lifespan)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving for uploaded logos ─────────────────────────────────────
_uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")

# ── fastapi-users routes ───────────────────────────────────────────────────────
# Custom login router replaces fastapi_users.get_auth_router entirely so that
# /auth/jwt/login can be gated by hCaptcha. It also re-implements /auth/jwt/logout
# to preserve parity with the built-in router without producing duplicate routes.
app.include_router(login_router, prefix="/auth", tags=["auth"])
# Custom register route gates self-registration behind hCaptcha; replaces fastapi_users.get_register_router.
app.include_router(register_router, prefix="/auth", tags=["auth"])
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# ── Application routes ─────────────────────────────────────────────────────────
app.include_router(articles_router, prefix="/api/v1", tags=["articles"])
app.include_router(admin_router, prefix="/api/v1", tags=["admin"])
app.include_router(profile_router, prefix="/api/v1", tags=["profile"])
app.include_router(author_router, prefix="/api/v1", tags=["author"])


@app.get("/api/v1/theme/active", response_model=ThemeActiveResponse, tags=["theme"])
async def active_theme(session: AsyncSession = Depends(get_async_session)):
    theme = await get_active_theme(session)
    return ThemeActiveResponse(url=theme.url if theme else None)


@app.get("/api/v1/settings", tags=["settings"])
async def public_settings(session: AsyncSession = Depends(get_async_session)):
    config = await get_site_config(session)
    return {
        "site_name": config.site_name,
        "site_description": config.site_description,
        "site_url": config.site_url,
        "logo_url": config.logo_url,
        "allow_registration": config.allow_registration,
        "og_title": config.og_title,
        "og_description": config.og_description,
        "og_image_url": config.og_image_url,
    }
