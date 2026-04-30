import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import UserRead, UserCreate, UserUpdate
from app.models.theme import ThemeActiveResponse
from app.api.v1.articles import router as articles_router
from app.api.v1.admin import router as admin_router
from app.database.db import create_db_and_tables, get_async_session
from app.core.users import fastapi_users, auth_backend
from app.services.theme import get_active_theme
from app.services.site_settings import get_site_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
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
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
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


@app.get("/api/v1/theme/active", response_model=ThemeActiveResponse, tags=["theme"])
async def active_theme(session: AsyncSession = Depends(get_async_session)):
    theme = await get_active_theme(session)
    return ThemeActiveResponse(url=theme.url if theme else None)


@app.get("/api/v1/settings", tags=["settings"])
async def public_settings(session: AsyncSession = Depends(get_async_session)):
    config = await get_site_config(session)
    return {"site_name": config.site_name, "logo_url": config.logo_url}
