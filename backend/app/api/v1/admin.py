from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_async_session
from app.core.users import fastapi_users
from app.models.theme import ThemeBase, ThemeRead
from app.services.admin import list_users, set_user_active
from app.services.theme import (
    list_themes,
    create_theme,
    set_active_theme,
    delete_theme,
)

router = APIRouter(prefix="/admin")

current_superuser = fastapi_users.current_user(active=True, superuser=True)


# ── User management ────────────────────────────────────────────────────────────

@router.get("/users")
async def get_users(
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    users = await list_users(session)
    return {"users": [
        {
            "id": str(u.id),
            "email": u.email,
            "is_active": u.is_active,
            "is_superuser": u.is_superuser,
            "is_verified": u.is_verified,
        }
        for u in users
    ]}


@router.patch("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    user = await set_user_active(session, user_id, active=True)
    return {"id": str(user.id), "email": user.email, "is_active": user.is_active}


@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    user = await set_user_active(session, user_id, active=False)
    return {"id": str(user.id), "email": user.email, "is_active": user.is_active}


# ── Theme management ───────────────────────────────────────────────────────────

@router.get("/themes")
async def get_themes(
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    themes = await list_themes(session)
    return {"themes": [ThemeRead.model_validate(t) for t in themes]}


@router.post("/themes", status_code=201)
async def add_theme(
    data: ThemeBase,
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    theme = await create_theme(session, data)
    return ThemeRead.model_validate(theme)


@router.put("/themes/{theme_id}/activate")
async def activate_theme(
    theme_id: int,
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    theme = await set_active_theme(session, theme_id)
    return ThemeRead.model_validate(theme)


@router.delete("/themes/{theme_id}")
async def remove_theme(
    theme_id: int,
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    return await delete_theme(session, theme_id)
