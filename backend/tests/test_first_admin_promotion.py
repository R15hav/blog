"""Regression tests: FIRST_ADMIN_EMAIL promotion matches emails case-insensitively,
like registration and login (ix_users_email_lower guarantees at most one match).

Run from backend/:
    uv run python -m unittest discover -s tests -v

Uses the shared throwaway SQLite database and fictional example.com accounts.
"""
import os
import sys
import unittest
import uuid
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import httpx  # noqa: E402
from sqlalchemy import func, select, update  # noqa: E402

from app.app import _promote_first_admin, app  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402

PASSWORD = "First-Admin-Test-Passw0rd!"


class FirstAdminPromotionTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        async with async_session_maker() as s:
            await s.execute(update(User).values(is_superuser=False))
            await s.commit()
            await update_site_config(s, allow_registration=True)
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("FIRST_ADMIN_EMAIL", None)

    async def asyncTearDown(self):
        self.env.stop()
        await self.client.aclose()
        await engine.dispose()

    # ── helpers ────────────────────────────────────────────────────────────────

    async def _register(self, email):
        r = await self.client.post("/auth/register", json={"email": email, "password": PASSWORD})
        self.assertEqual(r.status_code, 201, r.text)

    async def _user(self, email):
        async with async_session_maker() as s:
            rows = await s.execute(select(User).where(func.lower(User.email) == email.strip().lower()))
            return rows.scalars().one()

    def _assert_promoted(self, user):
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)
        self.assertEqual(user.role, "admin")

    # ── tests ──────────────────────────────────────────────────────────────────

    async def test_different_case_is_promoted_and_stored_spelling_unchanged(self):
        stored = f"Founder.Case+{self.suffix}@Example.com"
        await self._register(stored)
        # Registration keeps the local part as typed (the domain is normalised by validation).
        stored_before = (await self._user(stored)).email
        self.assertTrue(stored_before.startswith(f"Founder.Case+{self.suffix}@"))
        os.environ["FIRST_ADMIN_EMAIL"] = f"founder.case+{self.suffix}@example.com"

        await _promote_first_admin()

        user = await self._user(stored)
        self._assert_promoted(user)
        self.assertEqual(user.email, stored_before)

    async def test_exact_case_still_promotes(self):
        email = f"exact+{self.suffix}@example.com"
        await self._register(email)
        os.environ["FIRST_ADMIN_EMAIL"] = email

        await _promote_first_admin()

        self._assert_promoted(await self._user(email))

    async def test_whitespace_padded_value_is_tolerated(self):
        stored = f"Founder.Case+{self.suffix}@Example.com"
        await self._register(stored)
        stored_before = (await self._user(stored)).email
        os.environ["FIRST_ADMIN_EMAIL"] = f"  FOUNDER.CASE+{self.suffix}@EXAMPLE.COM  "

        await _promote_first_admin()

        user = await self._user(stored)
        self._assert_promoted(user)
        self.assertEqual(user.email, stored_before)

    async def test_other_accounts_are_untouched(self):
        others = [f"other-one+{self.suffix}@example.com", f"Other-Two+{self.suffix}@Example.com"]
        for email in others:
            await self._register(email)
        target = f"Founder.Case+{self.suffix}@Example.com"
        await self._register(target)
        os.environ["FIRST_ADMIN_EMAIL"] = target.lower()

        await _promote_first_admin()

        self._assert_promoted(await self._user(target))
        for email in others:
            user = await self._user(email)
            self.assertFalse(user.is_superuser, email)
            self.assertFalse(user.is_active, email)
            self.assertNotEqual(user.role, "admin", email)

    async def test_unset_variable_changes_nothing(self):
        email = f"unset+{self.suffix}@example.com"
        await self._register(email)

        await _promote_first_admin()

        user = await self._user(email)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_active)
        self.assertNotEqual(user.role, "admin")

    async def test_promoted_user_can_log_in_with_another_capitalisation(self):
        stored = f"Founder.Case+{self.suffix}@Example.com"
        await self._register(stored)
        os.environ["FIRST_ADMIN_EMAIL"] = f"founder.case+{self.suffix}@example.com"
        await _promote_first_admin()

        r = await self.client.post(
            "/auth/jwt/login",
            data={"username": f"FOUNDER.case+{self.suffix}@example.COM", "password": PASSWORD},
        )
        self.assertEqual(r.status_code, 200, r.text)


if __name__ == "__main__":
    unittest.main()
