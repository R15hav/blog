from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import current_author_or_admin
from app.database.db import User, Post, get_async_session
from app.services.articles import list_author_articles, list_comments_for_author

router = APIRouter(prefix="/author")


@router.get("/stats")
async def author_stats(
    user: User = Depends(current_author_or_admin),
    session: AsyncSession = Depends(get_async_session),
):
    total = (await session.execute(
        select(func.count()).select_from(Post).where(Post.owner_id == user.id)
    )).scalar() or 0
    published = (await session.execute(
        select(func.count()).select_from(Post).where(Post.owner_id == user.id, Post.published == "true")
    )).scalar() or 0
    return {"total": total, "published": published, "draft": total - published}


@router.get("/articles")
async def author_articles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    q: str = Query(""),
    user: User = Depends(current_author_or_admin),
    session: AsyncSession = Depends(get_async_session),
):
    articles, total = await list_author_articles(session, user.id, skip, limit, q)
    return {"articles": articles, "total": total}


@router.get("/comments")
async def author_comments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(current_author_or_admin),
    session: AsyncSession = Depends(get_async_session),
):
    comments, total = await list_comments_for_author(session, user.id, skip, limit)
    return {"comments": comments, "total": total}
