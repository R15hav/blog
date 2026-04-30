import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.db import User


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
