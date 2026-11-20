"""Tests for #84: get_site_config() is safe when concurrent first requests race.

Run from backend/:
    uv run python -m unittest tests.test_site_config_race -v

Uses its own temporary SQLite database (not the shared _isolated_db one)
because every test must start without a site_configs row.
"""
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.database.db import Base, SiteConfig  # noqa: E402
from app.services.site_settings import get_site_config  # noqa: E402


class GetSiteConfigRaceTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.engine = create_async_engine(f"sqlite+aiosqlite:///{self._tmp.name}/race.db")
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        self.maker = async_sessionmaker(self.engine, expire_on_commit=False)

    async def asyncTearDown(self):
        await self.engine.dispose()

    async def _row_count(self):
        async with self.maker() as s:
            return (await s.execute(select(func.count()).select_from(SiteConfig))).scalar_one()

    async def test_normal_path_creates_defaults_once(self):
        async with self.maker() as s:
            config = await get_site_config(s)
            self.assertEqual(config.id, 1)
            self.assertEqual(config.site_name, "My Blog")
            self.assertIs(config.allow_registration, True)
        async with self.maker() as s:
            again = await get_site_config(s)
            self.assertEqual((again.id, again.site_name), (1, "My Blog"))
        self.assertEqual(await self._row_count(), 1)

    async def test_lost_race_returns_the_winners_row(self):
        async with self.maker() as session_a:
            real_execute = session_a.execute
            calls = []

            async def execute_then_lose_race(*args, **kwargs):
                calls.append(1)
                result = await real_execute(*args, **kwargs)
                if len(calls) == 1:  # A saw "no row"; now B inserts and commits
                    async with self.maker() as session_b:
                        session_b.add(SiteConfig(id=1, site_name="Winner"))
                        await session_b.commit()
                return result

            with mock.patch.object(session_a, "execute", execute_then_lose_race):
                config = await get_site_config(session_a)
            self.assertEqual(config.site_name, "Winner")
        self.assertEqual(await self._row_count(), 1)

    async def test_unrelated_integrity_error_is_reraised(self):
        async with self.maker() as session_a:
            failing_commit = mock.AsyncMock(side_effect=IntegrityError("INSERT", {}, Exception("boom")))
            with mock.patch.object(session_a, "commit", failing_commit):
                with self.assertRaises(IntegrityError):
                    await get_site_config(session_a)
        self.assertEqual(await self._row_count(), 0)


if __name__ == "__main__":
    unittest.main()
