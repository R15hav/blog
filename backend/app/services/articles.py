import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database.db import Post, Like, Comment


def _post_to_dict(post: Post) -> dict:
    return {
        "id": str(post.id),
        "owner_id": str(post.owner_id),
        "title": post.title,
        "content": post.content,
        "published": post.published,
        "created_date": post.created_date,
        "author_email": post.owner.email if post.owner else None,
        "like_count": len(post.likes),
        "comment_count": len(post.comments),
    }


def _post_opts():
    return (
        selectinload(Post.owner),
        selectinload(Post.likes),
        selectinload(Post.comments),
    )


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
    result = await session.execute(
        select(Post)
        .options(*_post_opts())
        .order_by(Post.created_date.desc())
        .offset(skip)
        .limit(limit)
    )
    posts = result.scalars().all()
    return [_post_to_dict(p) for p in posts], total


async def search_articles(session: AsyncSession, title: str):
    result = await session.execute(
        select(Post)
        .options(*_post_opts())
        .where(Post.title.ilike(f"%{title}%"))
    )
    return [_post_to_dict(p) for p in result.scalars().all()]


async def get_article_by_id(session: AsyncSession, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        result = await session.execute(
            select(Post)
            .options(*_post_opts())
            .where(Post.id == article_id)
        )
        post = result.scalars().first()
        if not post:
            raise HTTPException(status_code=404, detail="Article not found")
        return [_post_to_dict(post)]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def delete_article(session: AsyncSession, user, id_str: str):
    try:
        article_id = uuid.UUID(id_str)
        result = await session.execute(select(Post).where(Post.id == article_id))
        article = result.scalars().first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
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
        result = await session.execute(select(Post).where(Post.id == article_id))
        article = result.scalars().first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
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


# ── Likes ──────────────────────────────────────────────────────────────────────

async def toggle_like(session: AsyncSession, post_id_str: str, user_id) -> dict:
    post_id = uuid.UUID(post_id_str)
    result = await session.execute(
        select(Like).where(Like.post_id == post_id, Like.user_id == user_id)
    )
    existing = result.scalars().first()
    if existing:
        await session.delete(existing)
        liked = False
    else:
        session.add(Like(post_id=post_id, user_id=user_id))
        liked = True
    await session.commit()
    count = (await session.execute(
        select(func.count()).select_from(Like).where(Like.post_id == post_id)
    )).scalar()
    return {"count": count, "user_liked": liked}


async def get_like_status(session: AsyncSession, post_id_str: str, user_id=None) -> dict:
    post_id = uuid.UUID(post_id_str)
    count = (await session.execute(
        select(func.count()).select_from(Like).where(Like.post_id == post_id)
    )).scalar()
    user_liked = False
    if user_id:
        row = (await session.execute(
            select(Like).where(Like.post_id == post_id, Like.user_id == user_id)
        )).scalars().first()
        user_liked = row is not None
    return {"count": count, "user_liked": user_liked}


# ── Comments ───────────────────────────────────────────────────────────────────

async def list_comments(session: AsyncSession, post_id_str: str) -> list:
    post_id = uuid.UUID(post_id_str)
    result = await session.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "author_email": c.author.email if c.author else "unknown",
            "body": c.body,
            "created_at": c.created_at,
        }
        for c in comments
    ]


async def add_comment(session: AsyncSession, post_id_str: str, author_id, body: str) -> dict:
    post_id = uuid.UUID(post_id_str)
    comment = Comment(post_id=post_id, author_id=author_id, body=body)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    result = await session.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
    )
    c = result.scalars().first()
    return {
        "id": str(c.id),
        "author_email": c.author.email if c.author else "unknown",
        "body": c.body,
        "created_at": c.created_at,
    }


async def delete_comment(session: AsyncSession, comment_id_str: str, user) -> dict:
    comment_id = uuid.UUID(comment_id_str)
    result = await session.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalars().first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if not user.is_superuser and comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await session.delete(comment)
    await session.commit()
    return {"success": True}
