"""Regression tests: unpublished articles must not be discoverable or readable by
callers other than their owner or an admin.

Run from backend/:
    uv run python -m unittest discover -s tests -v

Each test run uses a fresh, throwaway SQLite database in a temporary directory.
No external services, real data or network access are required.
"""
import logging
import os
import tempfile
import unittest
import uuid

# IsolatedAsyncioTestCase runs the loop in debug mode, which logs a warning for
# every callback slower than 100 ms (password hashing is). That is noise here.
logging.getLogger("asyncio").setLevel(logging.ERROR)

# Point the app at an isolated database *before* any app module is imported:
# app.database.db builds its engine from DATABASE_URL at import time.
_TMP = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP.name}/visibility-test.db"
os.environ["HCAPTCHA_ENABLED"] = "false"
os.environ.pop("FIRST_ADMIN_EMAIL", None)

import httpx  # noqa: E402
from sqlalchemy import update  # noqa: E402

from app.app import app  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402

PASSWORD = "Visibility-Test-Passw0rd!"
DRAFT_TITLE = "Zebra draft notes"
PUBLISHED_TITLE = "Zebra published notes"
CONTENT = '{"time": 0, "blocks": [{"type": "paragraph", "data": {"text": "Test body."}}]}'

# role -> (email, is_superuser, role column)
ACCOUNTS = {
    "owner": ("owner@example.com", False, "author"),
    "other_author": ("other-author@example.com", False, "author"),
    "guest": ("guest@example.com", False, "guest"),
    "admin": ("admin@example.com", True, "admin"),
}


class ArticleVisibilityTests(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: one owner with a draft and a published article, plus other callers."""

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        suffix = uuid.uuid4().hex[:8]  # unique emails per test; the DB persists across tests
        self.tokens = {}
        for key, (email, is_superuser, role) in ACCOUNTS.items():
            email = email.replace("@", f"+{suffix}@")
            r = await self.client.post("/auth/register", json={"email": email, "password": PASSWORD})
            self.assertEqual(r.status_code, 201, r.text)
            async with async_session_maker() as s:
                await s.execute(
                    update(User).where(User.email == email)
                    .values(is_active=True, is_superuser=is_superuser, role=role)
                )
                await s.commit()
            r = await self.client.post("/auth/jwt/login", data={"username": email, "password": PASSWORD})
            self.assertEqual(r.status_code, 200, r.text)
            self.tokens[key] = r.json()["access_token"]

        self.draft_id = await self._create("owner", f"{DRAFT_TITLE} {suffix}", published=False)
        self.published_id = await self._create("owner", f"{PUBLISHED_TITLE} {suffix}", published=True)
        self.suffix = suffix

    async def asyncTearDown(self):
        await self.client.aclose()

    # ── helpers ────────────────────────────────────────────────────────────────

    def _auth(self, who):
        return {} if who == "anonymous" else {"Authorization": f"Bearer {self.tokens[who]}"}

    async def _create(self, who, title, published):
        r = await self.client.post(
            "/api/v1/create-article",
            json={"title": title, "content": CONTENT, "published": published,
                  "created_date": "2026-11-01 10:00:00"},
            headers=self._auth(who),
        )
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["blog"]["id"]

    async def _search_ids(self, who, term):
        r = await self.client.get("/api/v1/search-articles", params={"title": term}, headers=self._auth(who))
        self.assertEqual(r.status_code, 200, r.text)
        return {a["id"] for a in r.json()["articles"]}

    # ── search ─────────────────────────────────────────────────────────────────

    async def test_search_hides_drafts_from_every_caller(self):
        # Drafts are reachable through the owner's dashboard and the admin list,
        # not through the public search endpoint.
        for who in ("anonymous", "guest", "other_author", "owner", "admin"):
            with self.subTest(caller=who):
                ids = await self._search_ids(who, f"draft notes {self.suffix}")
                self.assertNotIn(str(self.draft_id), ids)

    async def test_search_still_returns_published_articles(self):
        for who in ("anonymous", "guest", "other_author", "owner", "admin"):
            with self.subTest(caller=who):
                ids = await self._search_ids(who, f"published notes {self.suffix}")
                self.assertIn(str(self.published_id), ids)

    # ── direct retrieval ───────────────────────────────────────────────────────

    async def test_draft_retrieval_is_404_for_unauthorized_callers(self):
        for who in ("anonymous", "guest", "other_author"):
            with self.subTest(caller=who):
                r = await self.client.get(f"/api/v1/get-article/{self.draft_id}", headers=self._auth(who))
                self.assertEqual(r.status_code, 404, r.text)
                self.assertNotIn(DRAFT_TITLE, r.text)

    async def test_draft_retrieval_allowed_for_owner_and_admin(self):
        for who in ("owner", "admin"):
            with self.subTest(caller=who):
                r = await self.client.get(f"/api/v1/get-article/{self.draft_id}", headers=self._auth(who))
                self.assertEqual(r.status_code, 200, r.text)
                self.assertEqual(r.json()["article"][0]["id"], str(self.draft_id))

    async def test_published_retrieval_allowed_for_everyone(self):
        for who in ("anonymous", "guest", "other_author", "owner", "admin"):
            with self.subTest(caller=who):
                r = await self.client.get(f"/api/v1/get-article/{self.published_id}", headers=self._auth(who))
                self.assertEqual(r.status_code, 200, r.text)

    async def test_unknown_article_is_404(self):
        r = await self.client.get(f"/api/v1/get-article/{uuid.uuid4()}")
        self.assertEqual(r.status_code, 404, r.text)

    async def test_public_feed_excludes_drafts(self):
        r = await self.client.get("/api/v1/get-articles", params={"limit": 100})
        ids = {a["id"] for a in r.json()["articles"]}
        self.assertNotIn(str(self.draft_id), ids)
        self.assertIn(str(self.published_id), ids)

    # ── comments and likes on drafts ───────────────────────────────────────────

    async def test_draft_comments_and_likes_reads_are_404_for_unauthorized_callers(self):
        for who in ("anonymous", "guest", "other_author"):
            for path in ("comments", "likes"):
                with self.subTest(caller=who, path=path):
                    r = await self.client.get(f"/api/v1/articles/{self.draft_id}/{path}", headers=self._auth(who))
                    self.assertEqual(r.status_code, 404, r.text)

    async def test_draft_comment_and_like_writes_are_404_for_unauthorized_callers(self):
        for who in ("guest", "other_author"):
            with self.subTest(caller=who, action="comment"):
                r = await self.client.post(f"/api/v1/articles/{self.draft_id}/comments",
                                           json={"body": "hello"}, headers=self._auth(who))
                self.assertEqual(r.status_code, 404, r.text)
            with self.subTest(caller=who, action="like"):
                r = await self.client.post(f"/api/v1/articles/{self.draft_id}/like", headers=self._auth(who))
                self.assertEqual(r.status_code, 404, r.text)

    async def test_draft_comments_and_likes_allowed_for_owner_and_admin(self):
        for who in ("owner", "admin"):
            with self.subTest(caller=who):
                r = await self.client.get(f"/api/v1/articles/{self.draft_id}/comments", headers=self._auth(who))
                self.assertEqual(r.status_code, 200, r.text)
                r = await self.client.get(f"/api/v1/articles/{self.draft_id}/likes", headers=self._auth(who))
                self.assertEqual(r.status_code, 200, r.text)

    async def test_published_comments_and_likes_unchanged(self):
        r = await self.client.get(f"/api/v1/articles/{self.published_id}/comments")
        self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.get(f"/api/v1/articles/{self.published_id}/likes")
        self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.post(f"/api/v1/articles/{self.published_id}/comments",
                                   json={"body": "Nice piece."}, headers=self._auth("guest"))
        self.assertEqual(r.status_code, 201, r.text)
        r = await self.client.post(f"/api/v1/articles/{self.published_id}/like", headers=self._auth("guest"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["user_liked"])

    # ── owner and admin workflows ──────────────────────────────────────────────

    async def test_owner_dashboard_and_admin_list_still_include_drafts(self):
        r = await self.client.get("/api/v1/author/articles", params={"limit": 100}, headers=self._auth("owner"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn(str(self.draft_id), {a["id"] for a in r.json()["articles"]})
        r = await self.client.get("/api/v1/admin/articles", params={"limit": 100}, headers=self._auth("admin"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn(str(self.draft_id), {a["id"] for a in r.json()["articles"]})

    async def _update(self, who, article_id, published=False):
        return await self.client.put(
            f"/api/v1/update-article/{article_id}",
            json={"title": "Edited", "content": CONTENT, "published": published,
                  "created_date": "2026-11-03 10:00:00"},
            headers=self._auth(who),
        )

    async def test_non_owner_update_or_delete_of_draft_is_404(self):
        # Must not confirm the draft exists (previously 403).
        r = await self._update("other_author", self.draft_id)
        self.assertEqual(r.status_code, 404, r.text)
        for who in ("guest", "other_author"):
            with self.subTest(caller=who):
                r = await self.client.delete(f"/api/v1/delete-article/{self.draft_id}", headers=self._auth(who))
                self.assertEqual(r.status_code, 404, r.text)
        r = await self.client.get(f"/api/v1/get-article/{self.draft_id}", headers=self._auth("owner"))
        self.assertEqual(r.status_code, 200, r.text)  # draft untouched

    async def test_non_owner_update_or_delete_of_published_is_still_403(self):
        r = await self._update("other_author", self.published_id, published=True)
        self.assertEqual(r.status_code, 403, r.text)
        r = await self.client.delete(f"/api/v1/delete-article/{self.published_id}", headers=self._auth("other_author"))
        self.assertEqual(r.status_code, 403, r.text)

    async def test_admin_can_update_and_owner_can_delete_draft(self):
        r = await self._update("admin", self.draft_id)
        self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.delete(f"/api/v1/delete-article/{self.draft_id}", headers=self._auth("owner"))
        self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.get(f"/api/v1/get-article/{self.draft_id}", headers=self._auth("owner"))
        self.assertEqual(r.status_code, 404, r.text)

    async def test_unpublishing_hides_article_again(self):
        r = await self.client.get(f"/api/v1/get-article/{self.published_id}")
        self.assertEqual(r.status_code, 200, r.text)
        r = await self._update("owner", self.published_id, published=False)
        self.assertEqual(r.status_code, 200, r.text)
        for who in ("anonymous", "guest", "other_author"):
            with self.subTest(caller=who):
                r = await self.client.get(f"/api/v1/get-article/{self.published_id}", headers=self._auth(who))
                self.assertEqual(r.status_code, 404, r.text)
                self.assertNotIn(str(self.published_id),
                                 await self._search_ids(who, f"published notes {self.suffix}"))

    async def test_owner_can_still_update_and_publish_draft(self):
        r = await self.client.put(
            f"/api/v1/update-article/{self.draft_id}",
            json={"title": f"Now public {self.suffix}", "content": CONTENT, "published": True,
                  "created_date": "2026-11-02 10:00:00"},
            headers=self._auth("owner"),
        )
        self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.get(f"/api/v1/get-article/{self.draft_id}")
        self.assertEqual(r.status_code, 200, r.text)  # once published, it is public


def tearDownModule():
    import asyncio
    asyncio.run(engine.dispose())
    _TMP.cleanup()


if __name__ == "__main__":
    unittest.main()
