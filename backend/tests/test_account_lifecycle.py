"""Regression tests: newly registered accounts are inactive from the initial
INSERT, with no follow-up "deactivate" commit, and the approval / first-admin
paths still activate them.

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

from app.app import app  # noqa: E402
from app.core.users import UserManager  # noqa: E402
from app.services.bootstrap import bootstrap_first_admin  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402
# Import after the app: importing the db package first triggers a circular import.
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase  # noqa: E402

PASSWORD = "Lifecycle-Test-Passw0rd!"
CONTENT = '{"time": 0, "blocks": [{"type": "paragraph", "data": {"text": "Body."}}]}'


async def _db_is_active(email):
    """Read is_active straight from the database in a fresh session."""
    async with async_session_maker() as s:
        return (await s.execute(select(User.is_active).where(func.lower(User.email) == email.lower()))).scalar()


class AccountLifecycleTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        # Same isolation as test_registration_policy: open registration, no
        # superusers, no FIRST_ADMIN_EMAIL, hCaptcha off; restored in teardown.
        async with async_session_maker() as s:
            await s.execute(update(User).values(is_superuser=False))
            await s.commit()
            await update_site_config(s, allow_registration=True)
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("FIRST_ADMIN_EMAIL", None)
        os.environ.pop("FIRST_ADMIN_PASSWORD", None)

    async def asyncTearDown(self):
        self.env.stop()
        async with async_session_maker() as s:
            await update_site_config(s, allow_registration=True)
        await self.client.aclose()
        await engine.dispose()

    def _email(self, local):
        return f"{local}+{self.suffix}@example.com"

    async def _register(self, email):
        return await self.client.post("/auth/register", json={"email": email, "password": PASSWORD})

    async def _login(self, email):
        return await self.client.post("/auth/jwt/login", data={"username": email, "password": PASSWORD})

    # ── initial insert ─────────────────────────────────────────────────────────

    async def test_account_is_inactive_in_the_initial_insert(self):
        email = self._email("fresh")
        seen = {}
        original_create = SQLAlchemyUserDatabase.create

        async def spy_create(self_, create_dict):
            seen["is_active_in_insert_values"] = create_dict.get("is_active", "<not set: column default>")
            user = await original_create(self_, create_dict)   # INSERT + COMMIT
            seen["returned"] = user.is_active
            seen["db_before_hooks"] = await _db_is_active(email)  # separate session, hooks not yet run
            return user

        with mock.patch.object(SQLAlchemyUserDatabase, "create", spy_create):
            r = await self._register(email)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(seen["is_active_in_insert_values"], "<not set: column default>")
        self.assertIs(seen["returned"], False)
        self.assertIs(seen["db_before_hooks"], False)
        self.assertFalse(r.json()["is_active"])
        self.assertIs(await _db_is_active(email), False)

    async def test_registration_makes_no_follow_up_update(self):
        email = self._email("one-commit")
        calls = []
        original_update = SQLAlchemyUserDatabase.update

        async def spy_update(self_, user, update_dict):
            calls.append(dict(update_dict))
            return await original_update(self_, user, update_dict)

        with mock.patch.object(SQLAlchemyUserDatabase, "update", spy_update):
            r = await self._register(email)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(calls, [], "registration should not need a second (deactivating) write")
        self.assertIs(await _db_is_active(email), False)

    async def test_post_registration_hook_failure_cannot_leave_account_active(self):
        email = self._email("hook-crash")

        async def crashing_hook(self_, user, request=None):
            raise RuntimeError("simulated post-registration failure")
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
                                   base_url="http://test")
        try:
            with mock.patch.object(UserManager, "on_after_register", crashing_hook):
                r = await client.post("/auth/register", json={"email": email, "password": PASSWORD})
        finally:
            await client.aclose()
        self.assertEqual(r.status_code, 500, r.text)
        self.assertIs(await _db_is_active(email), False)   # row exists (committed) but inactive
        self.assertEqual((await self._login(email)).status_code, 400)

    # ── approval workflow ──────────────────────────────────────────────────────

    async def test_inactive_account_cannot_log_in(self):
        email = self._email("pending")
        self.assertEqual((await self._register(email)).status_code, 201)
        r = await self._login(email)
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["detail"], "LOGIN_BAD_CREDENTIALS")

    async def test_admin_approval_activates_and_author_role_still_works(self):
        admin_email = self._email("approver")
        self.assertEqual((await self._register(admin_email)).status_code, 201)
        async with async_session_maker() as s:
            await s.execute(update(User).where(User.email == admin_email)
                            .values(is_superuser=True, is_active=True, role="admin"))
            await s.commit()
        admin = {"Authorization": f"Bearer {(await self._login(admin_email)).json()['access_token']}"}

        email = self._email("writer")
        r = await self._register(email)
        self.assertEqual(r.status_code, 201, r.text)
        user_id = r.json()["id"]

        r = await self.client.patch(f"/api/v1/admin/users/{user_id}/activate", headers=admin)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["is_active"])
        self.assertIs(await _db_is_active(email), True)

        login = await self._login(email)
        self.assertEqual(login.status_code, 200, login.text)
        me = {"Authorization": f"Bearer {login.json()['access_token']}"}
        article = {"title": "Approved", "content": CONTENT, "published": True, "created_date": "2026-11-01 10:00:00"}
        self.assertEqual((await self.client.post("/api/v1/create-article", json=article, headers=me)).status_code,
                         403)  # approved guest: no author rights yet

        r = await self.client.patch(f"/api/v1/admin/users/{user_id}/role", json={"role": "author"}, headers=admin)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((await self.client.post("/api/v1/create-article", json=article, headers=me)).status_code,
                         200)  # author permissions unchanged

    # ── first-admin bootstrap ──────────────────────────────────────────────────

    async def test_env_bootstrap_creates_active_admin_who_can_log_in(self):
        email = self._email("founder")
        os.environ["FIRST_ADMIN_EMAIL"] = email
        os.environ["FIRST_ADMIN_PASSWORD"] = PASSWORD

        self.assertEqual(await bootstrap_first_admin(), "created")   # what the lifespan handler runs

        async with async_session_maker() as s:
            user = (await s.execute(select(User).where(User.email == email))).scalars().one()
        self.assertTrue(user.is_active and user.is_superuser)
        self.assertEqual(user.role, "admin")
        r = await self._login(email)
        self.assertEqual(r.status_code, 200, r.text)
        me = await self.client.get("/users/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
        self.assertEqual(me.status_code, 200, me.text)
        self.assertTrue(me.json()["is_superuser"])
        self.assertEqual(me.json()["role"], "admin")


if __name__ == "__main__":
    unittest.main()
