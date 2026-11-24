"""Tests for GET /api/v1/health (readiness probe).

Run from backend/:
    uv run python -m unittest discover -s tests -v
"""
import asyncio
import os
import sys
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import httpx  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402

from app.api.v1 import health as health_module  # noqa: E402
from app.app import app  # noqa: E402
from app.database.db import get_async_session  # noqa: E402

LEAKY = ("SuperSecretPw123", "leakuser", "127.0.0.1", "leakdb", "Error", "refused")


class HealthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.engines = []

    async def asyncTearDown(self):
        app.dependency_overrides.pop(get_async_session, None)
        for engine in self.engines:
            await engine.dispose()
        await self.client.aclose()

    async def test_healthy_database_returns_ok_without_auth(self):
        r = await self.client.get("/api/v1/health")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json(), {"status": "ok"})

    async def test_unavailable_database_returns_503_without_details(self):
        engine = create_async_engine(
            "postgresql+asyncpg://leakuser:SuperSecretPw123@127.0.0.1:1/leakdb",
            connect_args={"timeout": 1},
        )
        self.engines.append(engine)

        async def broken_session():
            async with AsyncSession(engine) as session:
                yield session

        app.dependency_overrides[get_async_session] = broken_session
        with self.assertLogs("app.api.v1.health", level="WARNING") as logs:
            r = await self.client.get("/api/v1/health")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"status": "unavailable"})
        for word in LEAKY:
            self.assertNotIn(word, r.text)
        logged = "\n".join(logs.output)
        for word in ("SuperSecretPw123", "leakuser", "leakdb"):
            self.assertNotIn(word, logged)

    async def test_hung_database_is_bounded_by_timeout(self):
        class HangingSession:
            async def execute(self, *_a, **_kw):
                await asyncio.Event().wait()

        async def hanging_session():
            yield HangingSession()

        app.dependency_overrides[get_async_session] = hanging_session
        with mock.patch.object(health_module, "HEALTH_DB_TIMEOUT_SECONDS", 0.2):
            start = time.monotonic()
            r = await self.client.get("/api/v1/health")
            elapsed = time.monotonic() - start
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"status": "unavailable"})
        self.assertLess(elapsed, 2)

    def test_default_timeout_is_three_seconds(self):
        self.assertEqual(health_module.HEALTH_DB_TIMEOUT_SECONDS, 3)


if __name__ == "__main__":
    unittest.main()
