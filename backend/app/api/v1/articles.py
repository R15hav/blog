from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.articles import ArticleBase, CommentCreate
from app.database.db import get_async_session, User
from app.core.users import current_active_user, current_author_or_admin, current_optional_user
from app.services.articles import (
    create_article as svc_create_article,
    list_articles as svc_list_articles,
    search_articles as svc_search_articles,
    get_article_by_id as svc_get_article_by_id,
    delete_article as svc_delete_article,
    update_article as svc_update_article,
    toggle_like as svc_toggle_like,
    get_like_status as svc_get_like_status,
    list_comments as svc_list_comments,
    add_comment as svc_add_comment,
    delete_comment as svc_delete_comment,
    list_sitemap_entries as svc_list_sitemap_entries,
    get_sitemap_meta as svc_get_sitemap_meta,
)

router = APIRouter()


@router.post("/create-article")
async def create_article(
    post: ArticleBase,
    user: User = Depends(current_author_or_admin),
    session: AsyncSession = Depends(get_async_session),
):
    new_post = await svc_create_article(session, user, post)
    return {"blog": new_post}


@router.get("/get-articles")
async def get_articles(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    q: str = Query(""),
    session: AsyncSession = Depends(get_async_session),
):
    articles, total = await svc_list_articles(session, skip, limit, q)
    return {"articles": articles, "total": total}


@router.get("/search-articles")
async def search_articles(
    title: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_async_session),
):
    articles = await svc_search_articles(session, title)
    return {"articles": articles}


@router.get("/get-article/{id}")
async def get_article(id: str, session: AsyncSession = Depends(get_async_session)):
    article = await svc_get_article_by_id(session, id)
    return {"article": article}


@router.put("/update-article/{id}")
async def update_article(
    id: str,
    post: ArticleBase,
    user: User = Depends(current_author_or_admin),
    session: AsyncSession = Depends(get_async_session),
):
    updated_post = await svc_update_article(session, user, id, post)
    return {"article": updated_post}


@router.delete("/delete-article/{id}")
async def delete_article(
    id: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await svc_delete_article(session, user, id)
    return result


# ── Likes ──────────────────────────────────────────────────────────────────────

@router.post("/articles/{id}/like")
async def like_article(
    id: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc_toggle_like(session, id, user.id)


@router.get("/articles/{id}/likes")
async def article_likes(
    id: str,
    session: AsyncSession = Depends(get_async_session),
    user: Optional[User] = Depends(current_optional_user),
):
    user_id = getattr(user, "id", None)
    return await svc_get_like_status(session, id, user_id)


# ── Comments ───────────────────────────────────────────────────────────────────

@router.get("/articles/{id}/comments")
async def article_comments(
    id: str,
    session: AsyncSession = Depends(get_async_session),
):
    return await svc_list_comments(session, id)


@router.post("/articles/{id}/comments", status_code=201)
async def post_comment(
    id: str,
    data: CommentCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc_add_comment(session, id, user.id, data.body)


@router.delete("/articles/{id}/comments/{comment_id}")
async def remove_comment(
    id: str,
    comment_id: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc_delete_comment(session, comment_id, user)


# ── Sitemap (SEO crawl-wall) ───────────────────────────────────────────────────

_SITEMAP_CACHE_CONTROL = (
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
)


@router.get("/sitemap/articles")
async def sitemap_articles(
    response: Response,
    page: int = Query(1, ge=1),
    per_page: int = Query(5000, ge=1, le=5000),
    session: AsyncSession = Depends(get_async_session),
):
    items, total = await svc_list_sitemap_entries(session, page, per_page)
    total_pages = (total + per_page - 1) // per_page if total else 0
    response.headers["Cache-Control"] = _SITEMAP_CACHE_CONTROL
    return {
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": total_pages,
        "items": items,
    }


@router.get("/sitemap/meta")
async def sitemap_meta(
    response: Response,
    session: AsyncSession = Depends(get_async_session),
):
    response.headers["Cache-Control"] = _SITEMAP_CACHE_CONTROL
    return await svc_get_sitemap_meta(session)
