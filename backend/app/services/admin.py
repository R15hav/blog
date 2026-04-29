import uuid
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import User


async def list_users(session: AsyncSession):
    results = await session.execute(select(User).order_by(User.email))
    return results.scalars().all()


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
