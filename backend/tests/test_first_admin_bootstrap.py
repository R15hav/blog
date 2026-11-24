"""Regression tests for #104: the first administrator is created from
FIRST_ADMIN_EMAIL + FIRST_ADMIN_PASSWORD, never granted by an email match.

Run from backend/:
    uv run python -m unittest discover -s tests -v

Uses the shared throwaway SQLite database and fictional example.com accounts.
"""
import asyncio
import os
import sys
import unittest
import uuid
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import httpx  # noqa: E402
from sqlalchemy import func, select, update  # noqa: E402

from app.app import app  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.bootstrap import bootstrap_first_admin  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402

ADMIN_PASSWORD = "Operator-Bootstrap-Passw0rd!"
OTHER_PASSWORD = "Attacker-Chosen-Passw0rd!"
LOGGER = "app.services.bootstrap"


class FirstAdminBootstrapTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        self.email = f"Founder.{self.suffix}@example.com"
        async with async_session_maker() as s:
            await s.execute(update(User).values(is_superuser=False))
            await s.commit()
            await update_site_config(s, allow_registration=True)
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("FIRST_ADMIN_EMAIL", None)
        os.environ.pop("FIRST_ADMIN_PASSWORD", None)

    async def asyncTearDown(self):
        # Restore the shared DB: no superusers left behind, registration open.
        async with async_session_maker() as s:
            await s.execute(update(User).values(is_superuser=False))
            await s.commit()
            await update_site_config(s, allow_registration=True)
        self.env.stop()
        await self.client.aclose()
        await engine.dispose()

    # ── helpers ────────────────────────────────────────────────────────────────

    def _configure(self, email=None, password=ADMIN_PASSWORD):
        os.environ["FIRST_ADMIN_EMAIL"] = email or self.email
        if password is None:
            os.environ.pop("FIRST_ADMIN_PASSWORD", None)
        else:
            os.environ["FIRST_ADMIN_PASSWORD"] = password

    async def _register(self, email, password):
        return await self.client.post("/auth/register", json={"email": email, "password": password})

    async def _accounts(self, email):
        async with async_session_maker() as s:
            rows = await s.execute(select(User).where(func.lower(User.email) == email.lower()))
            return rows.scalars().all()

    async def _superusers(self):
        async with async_session_maker() as s:
            return (await s.execute(select(User).where(User.is_superuser.is_(True)))).scalars().all()

    async def _login(self, email, password):
        return await self.client.post("/auth/jwt/login", data={"username": email, "password": password})

    # ── tests ──────────────────────────────────────────────────────────────────

    async def test_fresh_provisioning_creates_active_verified_admin(self):
        self._configure()
        with self.assertLogs(LOGGER, "WARNING"):
            self.assertEqual(await bootstrap_first_admin(), "created")
        [user] = await self._accounts(self.email)
        self.assertEqual(user.email, self.email)
        self.assertTrue(user.is_superuser and user.is_active and user.is_verified)
        self.assertEqual(user.role, "admin")
        r = await self._login(self.email, ADMIN_PASSWORD)
        self.assertEqual(r.status_code, 200, r.text)

    async def test_restart_is_idempotent(self):
        self._configure()
        self.assertEqual(await bootstrap_first_admin(), "created")
        async with async_session_maker() as s:
            before = {u.id: (u.email, u.is_superuser, u.hashed_password)
                      for u in (await s.execute(select(User))).scalars().all()}
        with self.assertLogs(LOGGER, "WARNING") as logs:
            self.assertEqual(await bootstrap_first_admin(), "exists")
        self.assertIn("already exists", "\n".join(logs.output))
        self.assertNotIn(ADMIN_PASSWORD, "\n".join(logs.output))
        self.assertEqual(len(await self._accounts(self.email)), 1)
        async with async_session_maker() as s:
            after = {u.id: (u.email, u.is_superuser, u.hashed_password)
                     for u in (await s.execute(select(User))).scalars().all()}
        self.assertEqual(before, after)

    async def test_attacker_preregistration_is_not_promoted(self):
        r = await self._register(self.email.swapcase(), OTHER_PASSWORD)
        self.assertEqual(r.status_code, 201, r.text)
        self._configure()
        with self.assertLogs(LOGGER, "ERROR") as logs:
            self.assertEqual(await bootstrap_first_admin(), "refused")
        self.assertNotIn(ADMIN_PASSWORD, "\n".join(logs.output))
        self.assertNotIn(OTHER_PASSWORD, "\n".join(logs.output))
        [user] = await self._accounts(self.email)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_active)
        self.assertNotEqual(user.role, "admin")
        self.assertEqual(await self._superusers(), [])

    async def test_operator_preregistration_is_promoted_and_spelling_kept(self):
        r = await self._register(self.email, ADMIN_PASSWORD)
        self.assertEqual(r.status_code, 201, r.text)
        [before] = await self._accounts(self.email)
        self._configure(email=self.email.lower())
        with self.assertLogs(LOGGER, "WARNING"):
            self.assertEqual(await bootstrap_first_admin(), "promoted")
        [user] = await self._accounts(self.email)
        self.assertEqual(user.id, before.id)
        self.assertEqual(user.email, before.email)
        self.assertTrue(user.is_superuser and user.is_active)
        self.assertEqual(user.role, "admin")
        self.assertEqual((await self._login(self.email, ADMIN_PASSWORD)).status_code, 200)

    async def test_email_only_legacy_configuration_does_not_promote(self):
        r = await self._register(self.email, OTHER_PASSWORD)
        self.assertEqual(r.status_code, 201, r.text)
        self._configure(password=None)
        with self.assertLogs(LOGGER, "ERROR") as logs:
            self.assertEqual(await bootstrap_first_admin(), "skipped")
        self.assertIn("FIRST_ADMIN_PASSWORD", "\n".join(logs.output))
        [user] = await self._accounts(self.email)
        self.assertFalse(user.is_superuser or user.is_active)
        self.assertEqual(await self._superusers(), [])

    async def test_nothing_configured_is_skipped(self):
        self.assertEqual(await bootstrap_first_admin(), "skipped")
        self.assertEqual(await self._superusers(), [])

    async def test_weak_password_is_refused_and_creates_nothing(self):
        for password in (self.email, self.email.upper()):
            with self.subTest(password=password.isupper()):
                self._configure(password=password)
                with self.assertLogs(LOGGER, "ERROR"):
                    self.assertEqual(await bootstrap_first_admin(), "refused")
                self.assertEqual(await self._accounts(self.email), [])
                self.assertEqual(await self._superusers(), [])

    async def test_eleven_character_password_is_refused(self):
        self._configure(password="Abcdef-1234")
        self.assertEqual(len(os.environ["FIRST_ADMIN_PASSWORD"]), 11)
        with self.assertLogs(LOGGER, "ERROR"):
            self.assertEqual(await bootstrap_first_admin(), "refused")
        self.assertEqual(await self._accounts(self.email), [])

    async def test_existing_admin_is_kept_and_nothing_is_created(self):
        existing = f"existing-admin+{self.suffix}@example.com"
        self.assertEqual((await self._register(existing, ADMIN_PASSWORD)).status_code, 201)
        async with async_session_maker() as s:
            await s.execute(update(User).where(User.email == existing)
                            .values(is_superuser=True, is_active=True, role="admin"))
            await s.commit()
        self._configure(email=f"different+{self.suffix}@example.com")
        with self.assertLogs(LOGGER, "WARNING") as logs:
            self.assertEqual(await bootstrap_first_admin(), "exists")
        self.assertIn("ignored", "\n".join(logs.output))
        self.assertEqual(await self._accounts(os.environ["FIRST_ADMIN_EMAIL"]), [])
        [admin] = await self._superusers()
        self.assertEqual(admin.email, existing)
        self.assertTrue(admin.is_active)
        self.assertEqual(admin.role, "admin")

    async def test_later_registrations_are_inactive_and_not_superusers(self):
        self._configure()
        self.assertEqual(await bootstrap_first_admin(), "created")
        newcomer = f"newcomer+{self.suffix}@example.com"
        self.assertEqual((await self._register(newcomer, OTHER_PASSWORD)).status_code, 201)
        [user] = await self._accounts(newcomer)
        self.assertFalse(user.is_active or user.is_superuser)
        # Another case variant of the admin address is a duplicate, not a second admin.
        r = await self._register(self.email.upper(), OTHER_PASSWORD)
        self.assertEqual(r.status_code, 400, r.text)
        [admin] = await self._accounts(self.email)
        self.assertTrue(admin.is_superuser)
        self.assertEqual(len(await self._superusers()), 1)

    async def test_concurrent_bootstrap_creates_one_account_and_one_superuser(self):
        self._configure()
        results = await asyncio.gather(*(bootstrap_first_admin() for _ in range(5)), return_exceptions=True)
        for r in results:
            self.assertNotIsInstance(r, BaseException, results)
        self.assertEqual(results.count("created"), 1, results)
        self.assertEqual(len(await self._accounts(self.email)), 1)
        [admin] = await self._superusers()
        self.assertEqual(admin.email, self.email)
        self.assertEqual((await self._login(self.email, ADMIN_PASSWORD)).status_code, 200)


if __name__ == "__main__":
    unittest.main()
