from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database.db import ThemeConfig
from app.models.theme import ThemeBase


async def list_themes(session: AsyncSession):
    results = await session.execute(select(ThemeConfig).order_by(ThemeConfig.id))
    return results.scalars().all()


async def create_theme(session: AsyncSession, data: ThemeBase) -> ThemeConfig:
    theme = ThemeConfig(name=data.name, url=data.url, is_active=False)
    session.add(theme)
    await session.commit()
    await session.refresh(theme)
    return theme


async def set_active_theme(session: AsyncSession, theme_id: int) -> ThemeConfig:
    # Check target exists
    result = await session.execute(select(ThemeConfig).where(ThemeConfig.id == theme_id))
    theme = result.scalars().first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    # Deactivate all, then activate the target — two statements, both in the same transaction
    await session.execute(update(ThemeConfig).values(is_active=False))
    await session.execute(update(ThemeConfig).where(ThemeConfig.id == theme_id).values(is_active=True))
    await session.commit()
    await session.refresh(theme)
    return theme


async def get_active_theme(session: AsyncSession) -> ThemeConfig | None:
    result = await session.execute(select(ThemeConfig).where(ThemeConfig.is_active == True))
    return result.scalars().first()


async def delete_theme(session: AsyncSession, theme_id: int):
    result = await session.execute(select(ThemeConfig).where(ThemeConfig.id == theme_id))
    theme = result.scalars().first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    await session.delete(theme)
    await session.commit()
    return {"success": True}
