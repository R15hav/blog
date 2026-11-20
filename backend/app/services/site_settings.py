from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database.db import SiteConfig


async def get_site_config(session: AsyncSession) -> SiteConfig:
    result = await session.execute(select(SiteConfig).where(SiteConfig.id == 1))
    config = result.scalars().first()
    if not config:
        config = SiteConfig(id=1, site_name="My Blog", logo_url=None, allow_registration=True)
        session.add(config)
        try:
            await session.commit()
        except IntegrityError:
            # Concurrent first requests on an empty database can all see "no row"
            # and race on this INSERT; the losers land here. Use the winner's row.
            await session.rollback()
            result = await session.execute(select(SiteConfig).where(SiteConfig.id == 1))
            existing = result.scalars().first()
            if existing is None:
                raise  # not the lost race: some other integrity problem
            return existing
        await session.refresh(config)
    return config


async def update_site_config(
    session: AsyncSession,
    site_name: str | None = None,
    logo_url: str | None = None,
    allow_registration: bool | None = None,
    site_description: str | None = None,
    site_url: str | None = None,
    og_title: str | None = None,
    og_description: str | None = None,
    og_image_url: str | None = None,
) -> SiteConfig:
    config = await get_site_config(session)
    if site_name is not None:
        config.site_name = site_name
    if logo_url is not None:
        config.logo_url = logo_url
    if allow_registration is not None:
        config.allow_registration = allow_registration
    if site_description is not None:
        config.site_description = site_description
    if site_url is not None:
        config.site_url = site_url
    if og_title is not None:
        config.og_title = og_title if og_title else None
    if og_description is not None:
        config.og_description = og_description if og_description else None
    if og_image_url is not None:
        config.og_image_url = og_image_url if og_image_url else None
    session.add(config)
    await session.commit()
    await session.refresh(config)
    return config
