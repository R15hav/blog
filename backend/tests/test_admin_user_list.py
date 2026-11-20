"""Tests for #25: GET /api/v1/admin/users includes each user's stored role.

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
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402

PASSWORD = "AdminList-Test-Passw0rd!"
KEYS = {"id", "email", "is_active", "is_superuser", "is_verified", "role"}


class AdminUserListTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("FIRST_ADMIN_EMAIL", None)
        async with async_session_maker() as s:
            await update_site_config(s, allow_registration=True)

        self.admin = self._email("admin")
        self.guest = self._email("guest")
        self.author = self._email("author")
        for email in (self.admin, self.guest, self.author):
            r = await self.client.post("/auth/register", json={"email": email, "password": PASSWORD})
            self.assertEqual(r.status_code, 201, r.text)
        async with async_session_maker() as s:
            await s.execute(update(User).where(func.lower(User.email) == self.admin.lower())
                            .values(is_superuser=True, is_active=True, role="admin"))
            await s.execute(update(User).where(func.lower(User.email).in_([self.guest.lower(), self.author.lower()]))
                            .values(is_active=True))
            await s.commit()
        self.admin_headers = await self._auth(self.admin)
        self.ids = {}
        for email in (self.admin, self.guest, self.author):
            self.ids[email] = await self._user_id(email)
        r = await self.client.patch(f"/api/v1/admin/users/{self.ids[self.author]}/role",
                                    json={"role": "author"}, headers=self.admin_headers)
        self.assertEqual(r.status_code, 200, r.text)

    async def asyncTearDown(self):
        self.env.stop()
        async with async_session_maker() as s:
            # Leave no superuser behind for other test modules sharing this database.
            await s.execute(update(User).where(func.lower(User.email) == self.admin.lower())
                            .values(is_superuser=False))
            await s.commit()
        await self.client.aclose()
        await engine.dispose()

    def _email(self, local):
        return f"{local}+{self.suffix}@example.com"

    async def _auth(self, email):
        r = await self.client.post("/auth/jwt/login", data={"username": email, "password": PASSWORD})
        self.assertEqual(r.status_code, 200, r.text)
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    async def _user_id(self, email):
        async with async_session_maker() as s:
            return str((await s.execute(select(User.id).where(func.lower(User.email) == email.lower()))).scalar_one())

    async def _list(self, headers, **params):
        params = {"q": self.suffix, "limit": 100, **params}
        return await self.client.get("/api/v1/admin/users", params=params, headers=headers)

    async def test_role_is_listed(self):
        r = await self._list(self.admin_headers)
        self.assertEqual(r.status_code, 200, r.text)
        by_email = {u["email"]: u for u in r.json()["users"]}
        self.assertEqual(set(by_email), {self.admin, self.guest, self.author})
        self.assertEqual(by_email[self.admin]["role"], "admin")
        self.assertEqual(by_email[self.guest]["role"], "guest")
        self.assertEqual(by_email[self.author]["role"], "author")
        for u in by_email.values():
            self.assertEqual(set(u), KEYS)
        self.assertEqual(set(r.json()), {"users", "total"})

    async def test_role_survives_a_reload(self):
        r = await self.client.patch(f"/api/v1/admin/users/{self.ids[self.author]}/role",
                                    json={"role": "guest"}, headers=self.admin_headers)
        self.assertEqual(r.status_code, 200, r.text)
        r = await self._list(self.admin_headers)
        by_email = {u["email"]: u for u in r.json()["users"]}
        self.assertEqual(by_email[self.author]["role"], "guest")

    async def test_pagination_and_search_unaffected(self):
        r = await self._list(self.admin_headers, limit=1)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(r.json()["users"]), 1)
        self.assertEqual(r.json()["total"], 3)

    async def test_signed_out_gets_401(self):
        r = await self._list({})
        self.assertEqual(r.status_code, 401)

    async def test_guest_gets_403(self):
        r = await self._list(await self._auth(self.guest))
        self.assertEqual(r.status_code, 403)

    async def test_author_gets_403(self):
        r = await self._list(await self._auth(self.author))
        self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main()
