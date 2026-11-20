"""Throwaway PostgreSQL databases for live tests.

PAPER_TEST_POSTGRES_URL must point at a disposable PostgreSQL server without
SSL whose user may CREATE DATABASE (true for the official image's
POSTGRES_USER, which CI uses). Each temp_database() creates a uniquely named
database and drops it afterwards, so tests never share or keep state.
"""
import asyncio
import os
import uuid
from contextlib import contextmanager
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

PG_URL = os.getenv("PAPER_TEST_POSTGRES_URL")


def _with_database(url: str, name: str, scheme: str, sslmode: str | None) -> str:
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in ("sslmode", "ssl")]
    if sslmode:
        query.append(("sslmode", sslmode))
    return urlunsplit(parts._replace(scheme=scheme, path=f"/{name}", query=urlencode(query)))


async def _admin(statement: str) -> None:
    # CREATE/DROP DATABASE cannot run inside a transaction; asyncpg's execute()
    # outside an explicit transaction is autocommit.
    dsn = _with_database(PG_URL, urlsplit(PG_URL).path.lstrip("/"), "postgresql", "disable")
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(statement)
    finally:
        await conn.close()


@contextmanager
def temp_database():
    """Yield an app-style DATABASE_URL (sslmode=disable) for a fresh, empty database."""
    name = "paper_test_" + uuid.uuid4().hex[:12]
    asyncio.run(_admin(f'CREATE DATABASE "{name}"'))
    try:
        yield _with_database(PG_URL, name, "postgresql", "disable")
    finally:
        asyncio.run(_admin(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
