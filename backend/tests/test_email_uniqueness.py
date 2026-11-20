"""Regression tests for #55: one account per email address, regardless of case.

Run from backend/:
    uv run python -m unittest discover -s tests -v

Uses the shared throwaway SQLite database and fictional example.com accounts.
PostgreSQL behaviour (migration and concurrency) is covered by
test_email_migration.py and test_concurrent_registration_pg.py.
"""
import os
import sys
import tempfile
import unittest
import uuid
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import httpx  # noqa: E402
from sqlalchemy import func, insert, select, text  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from app.app import app  # noqa: E402
from app.database.db import Base, User, async_session_maker, create_db_and_tables, engine  # noqa: E402
# Import after the app: importing the db package first triggers a circular import.
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase  # noqa: E402

PASSWORD = "Uniqueness-Test-Passw0rd!"
DUPLICATE = "REGISTER_USER_ALREADY_EXISTS"


def _user_row(email):
    return dict(id=uuid.uuid4(), email=email, hashed_password="not-a-real-hash",
                is_active=False, is_superuser=False, is_verified=False)


class ModelMetadataTests(unittest.TestCase):

    def test_email_uniqueness_is_a_unique_index_on_lower_email(self):
        table = User.__table__
        self.assertFalse(table.c.email.unique)
        self.assertFalse(table.c.email.index)
        [index] = [i for i in table.indexes if i.name == "ix_users_email_lower"]
        self.assertTrue(index.unique)
        self.assertEqual(str(index.expressions[0]).lower(), "lower(users.email)")
        # No other (case-sensitive) unique index on email remains.
        others = [i for i in table.indexes if i is not index and "email" in str(list(i.expressions)).lower()]
        self.assertEqual(others, [])

    def test_create_all_builds_the_same_index_on_a_fresh_sqlite_database(self):
        async def build(path):
            eng = create_async_engine(f"sqlite+aiosqlite:///{path}")
            try:
                async with eng.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                    return (await conn.execute(text(
                        "select name, sql from sqlite_master where type='index' and tbl_name='users' and sql is not null"
                    ))).all()
            finally:
                await eng.dispose()

        import asyncio
        with tempfile.TemporaryDirectory() as d:
            rows = asyncio.run(build(os.path.join(d, "fresh.db")))
        self.assertEqual([r[0] for r in rows], ["ix_users_email_lower"])
        self.assertIn("UNIQUE INDEX", rows[0][1])
        self.assertIn("lower(email)", rows[0][1])


class CaseInsensitiveUniquenessTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("FIRST_ADMIN_EMAIL", None)

    async def asyncTearDown(self):
        self.env.stop()
        await self.client.aclose()
        await engine.dispose()

    def _email(self, local):
        return f"{local}+{self.suffix}@example.com"

    async def _register(self, email):
        return await self.client.post("/auth/register", json={"email": email, "password": PASSWORD})

    async def _accounts(self, email):
        async with async_session_maker() as s:
            return (await s.execute(select(User).where(func.lower(User.email) == email.lower()))).scalars().all()

    async def test_database_rejects_an_insert_differing_only_by_case(self):
        email = self._email("Direct.Insert")
        async with async_session_maker() as s:
            await s.execute(insert(User).values(**_user_row(email)))
            await s.commit()
        for variant in (email.lower(), email.upper()):
            with self.subTest(variant=variant):
                async with async_session_maker() as s:
                    with self.assertRaises(IntegrityError):
                        await s.execute(insert(User).values(**_user_row(variant)))
                        await s.commit()
        self.assertEqual(len(await self._accounts(email)), 1)

    async def test_registering_a_case_variant_returns_the_duplicate_error(self):
        email = self._email("Mixed.Case")
        r = await self._register(email)
        self.assertEqual(r.status_code, 201, r.text)
        for variant in (email.lower(), email.upper(), email.swapcase()):
            with self.subTest(variant=variant):
                r = await self._register(variant)
                self.assertEqual(r.status_code, 400, r.text)
                self.assertEqual(r.json()["detail"], DUPLICATE)
        [account] = await self._accounts(email)
        self.assertEqual(account.email, email)  # the first spelling is kept unchanged

    async def test_case_variant_that_slips_past_the_lookup_is_stopped_by_the_database(self):
        # Simulates the race #55 closes: the pre-insert lookup misses, so only the
        # case-insensitive index stands between a second account and the INSERT.
        email = self._email("Raced.Case")
        self.assertEqual((await self._register(email)).status_code, 201)

        async def lookup_misses(self_, _email):
            return None
        with mock.patch.object(SQLAlchemyUserDatabase, "get_by_email", lookup_misses):
            r = await self._register(email.upper())
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["detail"], DUPLICATE)
        self.assertEqual(len(await self._accounts(email)), 1)

    async def test_different_addresses_are_still_independent(self):
        a, b = self._email("alice"), self._email("alicia")
        self.assertEqual((await self._register(a)).status_code, 201)
        self.assertEqual((await self._register(b)).status_code, 201)


if __name__ == "__main__":
    unittest.main()
