from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.database.db import Post


async def create_article(session: AsyncSession, user, post):
    try:
        datetime_object = datetime.strptime(post.created_date, "%Y-%m-%d %H:%M:%S")
        new_post = Post(
            owner_id=user.id,
            title=post.title,
            content=post.content,
            published=str(post.published).lower(),
            created_date=datetime_object,
        )
        session.add(new_post)
        await session.commit()
        await session.refresh(new_post)
        return new_post
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def list_articles(session: AsyncSession, skip: int = 0, limit: int = 10):
    total = (await session.execute(select(func.count()).select_from(Post))).scalar()
    results = await session.execute(
        select(Post).order_by(Post.created_date.desc()).offset(skip).limit(limit)
    )
    return [row[0] for row in results.all()], total


async def search_articles(session: AsyncSession, title: str):
    results = await session.execute(
        select(Post).where(Post.title.ilike(f"%{title}%"))
    )
    return [row[0] for row in results.all()]


async def get_article_by_id(session: AsyncSession, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = [row[0] for row in results.all()]
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def delete_article(session: AsyncSession, user, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = results.scalars().first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        # Superusers can delete any article; authors only their own
        if not user.is_superuser and article.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this article")
        await session.delete(article)
        await session.commit()
        return {"success": True, "message": "Article deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def update_article(session: AsyncSession, user, id_str: str, post):
    try:
        article_id = uuid.UUID(id_str)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = results.scalars().first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        # Superusers can update any article; authors only their own
        if not user.is_superuser and article.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this article")
        datetime_object = datetime.strptime(post.created_date, "%Y-%m-%d %H:%M:%S")
        article.title = post.title
        article.content = post.content
        article.published = str(post.published).lower()
        article.created_date = datetime_object
        session.add(article)
        await session.commit()
        await session.refresh(article)
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
