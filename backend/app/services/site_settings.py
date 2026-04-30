from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import SiteConfig


async def get_site_config(session: AsyncSession) -> SiteConfig:
    result = await session.execute(select(SiteConfig).where(SiteConfig.id == 1))
    config = result.scalars().first()
    if not config:
        config = SiteConfig(id=1, site_name="My Blog", logo_url=None, allow_registration=True)
        session.add(config)
        await session.commit()
        await session.refresh(config)
    return config


async def update_site_config(
    session: AsyncSession,
    site_name: str | None,
    logo_url: str | None,
    allow_registration: bool | None = None,
) -> SiteConfig:
    config = await get_site_config(session)
    if site_name is not None:
        config.site_name = site_name
    if logo_url is not None:
        config.logo_url = logo_url
    if allow_registration is not None:
        config.allow_registration = allow_registration
    session.add(config)
    await session.commit()
    await session.refresh(config)
    return config
