"""Contract tests for the admin password reset the Admin -> Users screen relies on:
PATCH /users/{id} with {"password": ...} is superuser-only and changes the password.

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
from sqlalchemy import update  # noqa: E402

from app.app import app  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402

PASSWORD = "Old-Passw0rd-x"
NEW_PASSWORD = "New-Passw0rd-x"


class AdminPasswordResetTests(unittest.IsolatedAsyncioTestCase):

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

    def _email(self, local):
        return f"{local}+{self.suffix}@example.com"

    async def _make_user(self, local, *, role="guest", superuser=False):
        email = self._email(local)
        r = await self.client.post("/auth/register", json={"email": email, "password": PASSWORD})
        self.assertEqual(r.status_code, 201, r.text)
        async with async_session_maker() as s:
            await s.execute(update(User).where(User.email == email)
                            .values(is_active=True, is_superuser=superuser, role=role))
            await s.commit()
        return r.json()["id"], email

    async def _login(self, email, password=PASSWORD):
        return await self.client.post("/auth/jwt/login", data={"username": email, "password": password})

    async def _headers(self, email):
        r = await self._login(email)
        self.assertEqual(r.status_code, 200, r.text)
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    async def test_admin_resets_guest_password(self):
        _, admin_email = await self._make_user("admin", role="admin", superuser=True)
        guest_id, guest_email = await self._make_user("guest")
        admin = await self._headers(admin_email)

        r = await self.client.patch(f"/users/{guest_id}", json={"password": NEW_PASSWORD}, headers=admin)
        self.assertEqual(r.status_code, 200, r.text)

        old = await self._login(guest_email)
        self.assertEqual(old.status_code, 400, old.text)
        self.assertEqual(old.json()["detail"], "LOGIN_BAD_CREDENTIALS")
        self.assertEqual((await self._login(guest_email, NEW_PASSWORD)).status_code, 200)

    async def test_response_has_no_password_fields(self):
        _, admin_email = await self._make_user("admin", role="admin", superuser=True)
        guest_id, _ = await self._make_user("guest")
        admin = await self._headers(admin_email)

        r = await self.client.patch(f"/users/{guest_id}", json={"password": NEW_PASSWORD}, headers=admin)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn("hashed_password", r.json())
        self.assertNotIn("password", r.json())

    async def test_admin_resets_another_superuser(self):
        _, admin_email = await self._make_user("admin", role="admin", superuser=True)
        other_id, other_email = await self._make_user("admin2", role="admin", superuser=True)
        admin = await self._headers(admin_email)

        r = await self.client.patch(f"/users/{other_id}", json={"password": NEW_PASSWORD}, headers=admin)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((await self._login(other_email, NEW_PASSWORD)).status_code, 200)

    async def test_non_superusers_get_403_and_password_is_unchanged(self):
        target_id, target_email = await self._make_user("target")
        for local, role in (("author", "author"), ("guest", "guest")):
            _, email = await self._make_user(local, role=role)
            headers = await self._headers(email)
            r = await self.client.patch(f"/users/{target_id}", json={"password": NEW_PASSWORD}, headers=headers)
            self.assertEqual(r.status_code, 403, f"{role}: {r.text}")
        self.assertEqual((await self._login(target_email)).status_code, 200)
        self.assertEqual((await self._login(target_email, NEW_PASSWORD)).status_code, 400)

    async def test_signed_out_gets_401(self):
        target_id, target_email = await self._make_user("target")
        r = await self.client.patch(f"/users/{target_id}", json={"password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 401, r.text)
        self.assertEqual((await self._login(target_email)).status_code, 200)


if __name__ == "__main__":
    unittest.main()
