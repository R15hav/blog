import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import our models so autogenerate can detect them
from app.database.db import Base  # noqa: F401 — registers all models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url from the environment variable if set.
# Normalize PaaS-injected postgres:// / postgresql:// → postgresql+asyncpg://
# so the async engine can connect. SQLite URLs are left unchanged.
def _async_db_url(url: str) -> str:
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        return url
    parsed = urlparse(url)
    params = {k: v[0] for k, v in parse_qs(parsed.query, keep_blank_values=True).items()
              if k not in ("ssl", "sslmode")}
    return urlunparse(parsed._replace(query=urlencode(params)))

DATABASE_URL = _async_db_url(os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db"))
config.set_main_option("sqlalchemy.url", DATABASE_URL)

_pg_connect_args: dict = {}
if not DATABASE_URL.startswith("sqlite"):
    _pg_connect_args = {"ssl": bool(os.getenv("RENDER")), "timeout": 10}


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # required for SQLite ALTER TABLE support
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=_pg_connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
