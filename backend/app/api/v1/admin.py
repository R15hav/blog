import os
import uuid as _uuid

from fastapi import APIRouter, Depends, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_async_session, Post, User
from app.core.users import fastapi_users
from app.models.theme import ThemeBase, ThemeRead
from app.services.admin import list_users, set_user_active, list_all_comments
from app.services.articles import list_all_articles
from app.services.site_settings import get_site_config, update_site_config
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
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    q: str = Query(""),
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    users, total = await list_users(session, skip=skip, limit=limit, search=q)
    return {
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "is_active": u.is_active,
                "is_superuser": u.is_superuser,
                "is_verified": u.is_verified,
            }
            for u in users
        ],
        "total": total,
    }


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


# ── Dashboard stats ────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    total_articles = (await session.execute(select(func.count(Post.id)))).scalar() or 0
    published_articles = (
        await session.execute(select(func.count(Post.id)).where(Post.published == "true"))
    ).scalar() or 0
    total_users = (await session.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (
        await session.execute(select(func.count(User.id)).where(User.is_active == True))
    ).scalar() or 0

    return {
        "articles": {
            "total": total_articles,
            "published": published_articles,
            "draft": total_articles - published_articles,
        },
        "users": {
            "total": total_users,
            "active": active_users,
        },
    }


# ── Site settings ──────────────────────────────────────────────────────────────

class SiteConfigUpdate(BaseModel):
    site_name: str | None = None
    site_description: str | None = None
    site_url: str | None = None
    logo_url: str | None = None
    allow_registration: bool | None = None
    og_title: str | None = None
    og_description: str | None = None
    og_image_url: str | None = None


def _config_response(config):
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


@router.get("/settings")
async def get_settings(
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    config = await get_site_config(session)
    return _config_response(config)


@router.put("/settings")
async def put_settings(
    data: SiteConfigUpdate,
    session: AsyncSession = Depends(get_async_session),
    _=Depends(current_superuser),
):
    config = await update_site_config(
        session,
        site_name=data.site_name,
        logo_url=data.logo_url,
        allow_registration=data.allow_registration,
        site_description=data.site_description,
        site_url=data.site_url,
        og_title=data.og_title,
        og_description=data.og_description,
        og_image_url=data.og_image_url,
    )
    return _config_response(config)


@router.get("/articles")
async def admin_all_articles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    q: str = Query(""),
    _=Depends(current_superuser),
    session: AsyncSession = Depends(get_async_session),
):
    articles, total = await list_all_articles(session, skip, limit, q)
    return {"articles": articles, "total": total}


@router.get("/comments")
async def admin_all_comments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str = Query(""),
    _=Depends(current_superuser),
    session: AsyncSession = Depends(get_async_session),
):
    comments, total = await list_all_comments(session, skip, limit, q)
    return {"comments": comments, "total": total}


@router.post("/upload-logo")
async def upload_logo(
    file: UploadFile = File(...),
    _=Depends(current_superuser),
):
    uploads_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "logo")[1] or ".png"
    filename = f"logo_{_uuid.uuid4().hex}{ext}"
    dest = os.path.join(uploads_dir, filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return {"url": f"/uploads/{filename}"}
