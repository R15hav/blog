from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database.db import Post


async def create_article(session: AsyncSession, user, post):
    """Business logic for creating an article.

    - Parses `post.created_date` (expects "%Y-%m-%d %H:%M:%S").
    - Creates `Post`, commits, refreshes and returns it.
    Raises `HTTPException` on failure.
    """
    try:
        format_pattern = "%Y-%m-%d %H:%M:%S"
        datetime_object = datetime.strptime(post.created_date, format_pattern)

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


async def list_articles(session: AsyncSession):
    results = await session.execute(select(Post))
    return [row[0] for row in results.all()]


async def get_article_by_id(session: AsyncSession, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = [row[0] for row in results.all()]
        if not article:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Article not found")
        return article
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


async def delete_article(session: AsyncSession, user, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = results.scalars().first()

        if not article:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Article not found")
        if article.owner_id != user.id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Not authorized to delete this article")

        await session.delete(article)
        await session.commit()
        return {"success": True, "message": "Article deleted successfully"}

    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
    
async def update_article(session: AsyncSession, user, id_str: str, post):
    """Business logic for updating an article.

    - Parses `post.created_date` (expects "%Y-%m-%d %H:%M:%S").
    - Updates `Post`, commits, refreshes and returns it.
    Raises `HTTPException` on failure.
    """
    try:
        article_id = uuid.UUID(id_str)
        results = await session.execute(select(Post).where(Post.id == article_id))
        article = results.scalars().first()

        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        if article.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this article")

        format_pattern = "%Y-%m-%d %H:%M:%S"
        datetime_object = datetime.strptime(post.created_date, format_pattern)

        article.title = post.title
        article.content = post.content
        article.published = str(post.published).lower()
        article.created_date = datetime_object

        session.add(article)
        await session.commit()
        await session.refresh(article)
        return article

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
