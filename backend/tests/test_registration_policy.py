"""Regression tests: the admin "Allow self-registration" setting is enforced by
the backend, with no exception for FIRST_ADMIN_EMAIL.

Run from backend/:
    uv run python -m unittest discover -s tests -v

Uses the shared throwaway SQLite database and fictional example.com accounts.
hCaptcha's verification endpoint is mocked; no network access is needed.
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
from sqlalchemy.exc import IntegrityError  # noqa: E402

from app.app import app  # noqa: E402
from app.core.users import UserManager  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402
# Import after the app: importing the db package first triggers a circular import.
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase  # noqa: E402

DUPLICATE = "REGISTER_USER_ALREADY_EXISTS"

PASSWORD = "Registration-Test-Passw0rd!"
CLOSED = "Registration is currently closed."


class _FakeCaptchaResponse:
    def __init__(self, success):
        self._success = success

    def raise_for_status(self):
        return None

    def json(self):
        return {"success": self._success, "error-codes": [] if self._success else ["invalid-input-response"]}


def fake_captcha_client(valid_tokens=("good-token",)):
    """Patch target for app.services.captcha.httpx.AsyncClient; records calls."""
    calls = []

    class _Client:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, data=None):
            calls.append(data)
            return _FakeCaptchaResponse(data.get("response") in valid_tokens)

    return _Client, calls


class RegistrationPolicyTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        # Start every test from a "not yet bootstrapped" state: no superusers,
        # registration open, no FIRST_ADMIN_EMAIL, hCaptcha off. Other test
        # modules create their own admins per test, so demoting here is safe.
        async with async_session_maker() as s:
            await s.execute(update(User).values(is_superuser=False))
            await s.commit()
        await self._set_registration(True)
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("FIRST_ADMIN_EMAIL", None)

    async def asyncTearDown(self):
        self.env.stop()
        await self._set_registration(True)  # never leave the shared DB closed
        await self.client.aclose()
        await engine.dispose()

    # ── helpers ────────────────────────────────────────────────────────────────

    async def _set_registration(self, allowed):
        async with async_session_maker() as s:
            await update_site_config(s, allow_registration=allowed)

    def _email(self, local):
        return f"{local}+{self.suffix}@example.com"

    async def _register(self, email, **extra):
        return await self.client.post("/auth/register", json={"email": email, "password": PASSWORD, **extra})

    async def _users_matching(self, email):
        async with async_session_maker() as s:
            rows = await s.execute(select(User).where(func.lower(User.email) == email.lower()))
            return rows.scalars().all()

    # ── setting enabled / disabled ─────────────────────────────────────────────

    async def test_open_registration_succeeds_and_account_is_inactive(self):
        email = self._email("reader")
        r = await self._register(email)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertFalse(r.json()["is_active"])
        [user] = await self._users_matching(email)
        self.assertFalse(user.is_active)
        self.assertFalse(user.is_superuser)

    async def test_closed_registration_returns_403_and_creates_no_user(self):
        await self._set_registration(False)
        email = self._email("blocked")
        r = await self._register(email)
        self.assertEqual(r.status_code, 403, r.text)
        self.assertEqual(r.json()["detail"], CLOSED)
        self.assertEqual(await self._users_matching(email), [])

    async def test_closed_registration_blocks_other_emails_even_with_first_admin_configured(self):
        await self._set_registration(False)
        os.environ["FIRST_ADMIN_EMAIL"] = self._email("founder")
        for other in (self._email("someone-else"), f"founder+{self.suffix}@example.org", f"x{self._email('founder')}"):
            with self.subTest(email=other):
                r = await self._register(other)
                self.assertEqual(r.status_code, 403, r.text)
                self.assertEqual(await self._users_matching(other), [])

    async def test_closed_registration_rejects_first_admin_email(self):
        await self._set_registration(False)
        email = self._email("founder")
        os.environ["FIRST_ADMIN_EMAIL"] = email
        for attempt in (email, email.upper()):
            r = await self._register(attempt)
            self.assertEqual(r.status_code, 403, r.text)
        self.assertEqual(await self._users_matching(email), [])

    # ── duplicate handling is limited to the INSERT ────────────────────────────

    async def test_unique_constraint_on_insert_is_reported_as_duplicate(self):
        # Simulate the race deterministically: the pre-insert lookup misses, so the
        # database's unique email index is what rejects the second INSERT.
        email = self._email("raced")
        self.assertEqual((await self._register(email)).status_code, 201)

        async def lookup_misses(self_, _email):
            return None
        with mock.patch.object(SQLAlchemyUserDatabase, "get_by_email", lookup_misses):
            r = await self._register(email)
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["detail"], DUPLICATE)
        self.assertEqual(len(await self._users_matching(email)), 1)

    async def test_non_duplicate_integrity_error_on_insert_is_not_reported_as_duplicate(self):
        email = self._email("insert-failure")

        async def failing_insert(self_, create_dict):
            raise IntegrityError("INSERT INTO user ...", {}, Exception("simulated unrelated constraint"))
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
                                   base_url="http://test")
        try:
            with mock.patch.object(SQLAlchemyUserDatabase, "create", failing_insert):
                r = await client.post("/auth/register", json={"email": email, "password": PASSWORD})
        finally:
            await client.aclose()
        self.assertEqual(r.status_code, 500, r.text)
        self.assertNotIn(DUPLICATE, r.text)
        self.assertEqual(await self._users_matching(email), [])

    async def test_integrity_error_after_insert_is_not_reported_as_duplicate(self):
        # An error raised in on_after_register (after the row is committed) must
        # surface as a server error, never as "email already exists".
        email = self._email("hook-failure")

        async def failing_hook(self_, user, request=None):
            raise IntegrityError("UPDATE user ...", {}, Exception("simulated unrelated constraint"))
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
                                   base_url="http://test")
        try:
            with mock.patch.object(UserManager, "on_after_register", failing_hook):
                r = await client.post("/auth/register", json={"email": email, "password": PASSWORD})
        finally:
            await client.aclose()
        self.assertEqual(r.status_code, 500, r.text)
        self.assertNotIn(DUPLICATE, r.text)
        # Database state after the failure: fastapi-users committed the row before
        # the hook runs. New accounts are inserted inactive (User.is_active
        # default), so a failing hook cannot leave an active, unapproved account.
        [user] = await self._users_matching(email)
        self.assertFalse(user.is_active)
        self.assertFalse(user.is_superuser)

    # ── hCaptcha interaction ───────────────────────────────────────────────────

    async def test_hcaptcha_enabled_open_registration(self):
        Client, calls = fake_captcha_client()
        with mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "true", "HCAPTCHA_SECRET": "test-secret"}), \
                mock.patch("app.services.captcha.httpx.AsyncClient", Client):
            r = await self._register(self._email("no-token"))
            self.assertEqual(r.status_code, 400, r.text)              # token required
            r = await self._register(self._email("bad-token"), hcaptcha_token="bad-token")
            self.assertEqual(r.status_code, 400, r.text)              # failed challenge
            r = await self._register(self._email("good"), hcaptcha_token="good-token")
            self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(len(calls), 2)
        self.assertEqual(await self._users_matching(self._email("no-token")), [])
        self.assertEqual(await self._users_matching(self._email("bad-token")), [])

    async def test_hcaptcha_enabled_closed_registration_rejects_before_captcha(self):
        await self._set_registration(False)
        Client, calls = fake_captcha_client()
        with mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "true", "HCAPTCHA_SECRET": "test-secret"}), \
                mock.patch("app.services.captcha.httpx.AsyncClient", Client):
            r = await self._register(self._email("blocked"), hcaptcha_token="good-token")
        self.assertEqual(r.status_code, 403, r.text)
        self.assertEqual(calls, [])  # policy is checked first; no captcha call made

    async def test_hcaptcha_disabled_needs_no_token(self):
        r = await self._register(self._email("plain"))
        self.assertEqual(r.status_code, 201, r.text)


if __name__ == "__main__":
    unittest.main()
