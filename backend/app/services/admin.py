import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database.db import User, Comment, Post


async def list_users(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    search: str = "",
):
    count_q = select(func.count(User.id))
    rows_q = select(User)
    if search:
        pattern = f"%{search}%"
        count_q = count_q.where(User.email.ilike(pattern))
        rows_q = rows_q.where(User.email.ilike(pattern))

    total = (await session.execute(count_q)).scalar() or 0
    result = await session.execute(rows_q.order_by(User.email).offset(skip).limit(limit))
    return result.scalars().all(), total


async def list_all_comments(session: AsyncSession, skip: int = 0, limit: int = 50, search: str = ""):
    count_q = select(func.count()).select_from(Comment).join(Post, Comment.post_id == Post.id)
    rows_q = (
        select(Comment)
        .options(selectinload(Comment.author), selectinload(Comment.post))
        .join(Post, Comment.post_id == Post.id)
    )
    if search:
        pattern = f"%{search}%"
        filt = (Comment.body.ilike(pattern)) | (Post.title.ilike(pattern))
        count_q = count_q.where(filt)
        rows_q = rows_q.where(filt)
    total = (await session.execute(count_q)).scalar() or 0
    comments = (await session.execute(
        rows_q.order_by(Comment.created_at.desc()).offset(skip).limit(limit)
    )).scalars().all()
    return [
        {
            "id": str(c.id),
            "post_id": str(c.post_id),
            "post_title": c.post.title if c.post else "",
            "author_email": c.author.email if c.author else "unknown",
            "body": c.body,
            "created_at": c.created_at,
        }
        for c in comments
    ], total


async def set_user_active(session: AsyncSession, user_id: str, active: bool) -> User:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    result = await session.execute(select(User).where(User.id == uid))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = active
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
