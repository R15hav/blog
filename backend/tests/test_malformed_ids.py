"""Regression tests: malformed IDs on like and comment endpoints return 4xx, not 500.

Run from backend/:
    uv run python -m unittest discover -s tests -v
"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import httpx  # noqa: E402
from sqlalchemy import update  # noqa: E402

from app.app import app  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402

PASSWORD = "Malformed-Id-Passw0rd!"
CONTENT = '{"time": 0, "blocks": [{"type": "paragraph", "data": {"text": "Test body."}}]}'
BAD = "not-a-uuid"


class MalformedIdTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        suffix = uuid.uuid4().hex[:8]
        self.tokens = {}
        for key, role in (("author", "author"), ("guest", "guest")):
            email = f"{key}+{suffix}@example.com"
            r = await self.client.post("/auth/register", json={"email": email, "password": PASSWORD})
            self.assertEqual(r.status_code, 201, r.text)
            async with async_session_maker() as s:
                await s.execute(update(User).where(User.email == email).values(is_active=True, role=role))
                await s.commit()
            r = await self.client.post("/auth/jwt/login", data={"username": email, "password": PASSWORD})
            self.assertEqual(r.status_code, 200, r.text)
            self.tokens[key] = r.json()["access_token"]
        r = await self.client.post(
            "/api/v1/create-article",
            json={"title": f"Malformed id article {suffix}", "content": CONTENT, "published": True,
                  "created_date": "2026-11-01 10:00:00"},
            headers=self._auth("author"),
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.article_id = r.json()["blog"]["id"]

    async def asyncTearDown(self):
        await self.client.aclose()
        await engine.dispose()

    def _auth(self, who):
        return {} if who == "anonymous" else {"Authorization": f"Bearer {self.tokens[who]}"}

    def _requests(self, article_id, comment_id):
        """(name, method, path, json, needs_auth)"""
        base = f"/api/v1/articles/{article_id}"
        return [
            ("like", "POST", f"{base}/like", None, True),
            ("likes", "GET", f"{base}/likes", None, False),
            ("list comments", "GET", f"{base}/comments", None, False),
            ("add comment", "POST", f"{base}/comments", {"body": "hi"}, True),
            ("delete comment", "DELETE", f"{base}/comments/{comment_id}", None, True),
        ]

    async def _send(self, method, path, body, who):
        return await self.client.request(method, path, json=body, headers=self._auth(who))

    async def test_malformed_ids_return_400(self):
        for name, method, path, body, needs_auth in self._requests(
            BAD, BAD
        )[:4] + self._requests(self.article_id, BAD)[4:]:
            callers = ("guest",) if needs_auth else ("anonymous", "guest")
            for who in callers:
                with self.subTest(endpoint=name, caller=who):
                    r = await self._send(method, path, body, who)
                    self.assertEqual(r.status_code, 400, r.text)

    async def test_signed_out_auth_routes_still_401(self):
        for article_id, comment_id in ((BAD, BAD), (self.article_id, BAD), (self.article_id, uuid.uuid4())):
            for name, method, path, body, needs_auth in self._requests(article_id, comment_id):
                if not needs_auth:
                    continue
                with self.subTest(endpoint=name, path=path):
                    r = await self._send(method, path, body, "anonymous")
                    self.assertEqual(r.status_code, 401, r.text)

    async def test_unknown_valid_uuid_still_404(self):
        for name, method, path, body, needs_auth in self._requests(uuid.uuid4(), uuid.uuid4()):
            with self.subTest(endpoint=name):
                r = await self._send(method, path, body, "guest")
                self.assertEqual(r.status_code, 404, r.text)

    async def test_valid_ids_unchanged(self):
        base = f"/api/v1/articles/{self.article_id}"
        r = await self.client.get(f"{base}/comments")
        self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.get(f"{base}/likes")
        self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.post(f"{base}/comments", json={"body": "Nice."}, headers=self._auth("guest"))
        self.assertEqual(r.status_code, 201, r.text)
        r = await self.client.post(f"{base}/like", headers=self._auth("guest"))
        self.assertEqual(r.status_code, 200, r.text)


if __name__ == "__main__":
    unittest.main()
