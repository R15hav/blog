"""Regression tests: public article and comment responses must not expose
author or commenter email addresses.

Run from backend/:
    uv run python -m unittest discover -s tests -v

Uses a throwaway SQLite database and fictional example.com addresses only.
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

PASSWORD = "Author-Fields-Test-Passw0rd!"
CONTENT = '{"time": 0, "blocks": [{"type": "paragraph", "data": {"text": "Test body."}}]}'

# key -> (email, first, last, is_superuser, role)
ACCOUNTS = {
    "author": ("author@example.com", "Ada", "Writer", False, "author"),
    "commenter": ("commenter@example.com", "Cora", "Reader", False, "guest"),
    "nameless": ("nameless@example.com", None, None, False, "guest"),
    "other_author": ("other@example.com", "Otto", "Author", False, "author"),
    "admin": ("admin@example.com", "Adam", "Admin", True, "admin"),
}


def _strings(obj):
    """Yield every string value (and key) in a JSON-like structure."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from _strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _strings(v)
    elif isinstance(obj, str):
        yield obj


class PublicAuthorFieldsTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        self.tokens, self.emails, self.ids = {}, {}, {}
        for key, (email, first, last, is_superuser, role) in ACCOUNTS.items():
            email = email.replace("@", f"+{self.suffix}@")
            body = {"email": email, "password": PASSWORD}
            if first:
                body.update(first_name=first, last_name=last)
            r = await self.client.post("/auth/register", json=body)
            self.assertEqual(r.status_code, 201, r.text)
            self.ids[key] = r.json()["id"]
            async with async_session_maker() as s:
                await s.execute(update(User).where(User.email == email)
                                .values(is_active=True, is_superuser=is_superuser, role=role))
                await s.commit()
            r = await self.client.post("/auth/jwt/login", data={"username": email, "password": PASSWORD})
            self.assertEqual(r.status_code, 200, r.text)
            self.tokens[key], self.emails[key] = r.json()["access_token"], email

        self.title = f"Field notes {self.suffix}"
        r = await self.client.post(
            "/api/v1/create-article",
            json={"title": self.title, "content": CONTENT, "published": True, "created_date": "2026-11-01 10:00:00"},
            headers=self._auth("author"),
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.article_id = r.json()["blog"]["id"]
        self.comment_ids = {}
        for who in ("commenter", "nameless"):
            r = await self.client.post(f"/api/v1/articles/{self.article_id}/comments",
                                       json={"body": f"Comment from {who}"}, headers=self._auth(who))
            self.assertEqual(r.status_code, 201, r.text)
            self.comment_ids[who] = r.json()["id"]

    async def asyncTearDown(self):
        await self.client.aclose()
        await engine.dispose()  # close pooled connections before this test's event loop ends

    def _auth(self, who):
        return {} if who == "anonymous" else {"Authorization": f"Bearer {self.tokens[who]}"}

    def assertNoEmails(self, payload, label):
        leaked = [s for s in _strings(payload) if "@" in s or "email" in s.lower()]
        self.assertEqual(leaked, [], f"{label} exposes email data: {leaked}")

    async def _public_payloads(self, who):
        h = self._auth(who)
        return {
            "comments": (await self.client.get(f"/api/v1/articles/{self.article_id}/comments", headers=h)).json(),
            "feed": (await self.client.get("/api/v1/get-articles", params={"limit": 100}, headers=h)).json(),
            "feed-q": (await self.client.get("/api/v1/get-articles", params={"q": self.suffix}, headers=h)).json(),
            "detail": (await self.client.get(f"/api/v1/get-article/{self.article_id}", headers=h)).json(),
            "search": (await self.client.get("/api/v1/search-articles", params={"title": self.suffix}, headers=h)).json(),
            "likes": (await self.client.get(f"/api/v1/articles/{self.article_id}/likes", headers=h)).json(),
        }

    # ── public responses ───────────────────────────────────────────────────────

    async def test_public_responses_contain_no_emails(self):
        for who in ("anonymous", "commenter", "other_author"):
            for label, payload in (await self._public_payloads(who)).items():
                with self.subTest(caller=who, endpoint=label):
                    self.assertNoEmails(payload, f"{label} as {who}")

    async def test_new_comment_response_contains_no_email(self):
        r = await self.client.post(f"/api/v1/articles/{self.article_id}/comments",
                                   json={"body": "Another one"}, headers=self._auth("commenter"))
        self.assertEqual(r.status_code, 201, r.text)
        self.assertNoEmails(r.json(), "create-comment response")

    async def test_author_dashboard_comments_contain_no_commenter_emails(self):
        r = await self.client.get("/api/v1/author/comments", headers=self._auth("author"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNoEmails(r.json(), "author dashboard comments")

    # ── display names ──────────────────────────────────────────────────────────

    async def test_public_author_and_commenter_names(self):
        detail = (await self.client.get(f"/api/v1/get-article/{self.article_id}")).json()["article"][0]
        self.assertEqual(detail["author_name"], "Ada Writer")
        self.assertEqual(detail["owner_id"], self.ids["author"])
        comments = (await self.client.get(f"/api/v1/articles/{self.article_id}/comments")).json()
        by_id = {c["id"]: c for c in comments}
        self.assertEqual(by_id[self.comment_ids["commenter"]]["author_name"], "Cora Reader")
        self.assertEqual(by_id[self.comment_ids["commenter"]]["author_id"], self.ids["commenter"])
        # A user without a first or last name gets a neutral label, never their email.
        self.assertEqual(by_id[self.comment_ids["nameless"]]["author_name"], "Member")
        self.assertEqual(by_id[self.comment_ids["nameless"]]["author_id"], self.ids["nameless"])

    # ── comment ownership ──────────────────────────────────────────────────────

    async def test_comment_owner_can_delete_own_comment(self):
        r = await self.client.delete(f"/api/v1/articles/{self.article_id}/comments/{self.comment_ids['commenter']}",
                                     headers=self._auth("commenter"))
        self.assertEqual(r.status_code, 200, r.text)

    async def test_non_owner_cannot_delete_comment(self):
        for who in ("nameless", "other_author", "author"):
            with self.subTest(caller=who):
                r = await self.client.delete(
                    f"/api/v1/articles/{self.article_id}/comments/{self.comment_ids['commenter']}",
                    headers=self._auth(who))
                self.assertEqual(r.status_code, 403, r.text)

    # ── admin moderation ───────────────────────────────────────────────────────

    async def test_admin_can_delete_any_comment(self):
        r = await self.client.delete(f"/api/v1/articles/{self.article_id}/comments/{self.comment_ids['nameless']}",
                                     headers=self._auth("admin"))
        self.assertEqual(r.status_code, 200, r.text)

    async def test_admin_moderation_list_keeps_commenter_email(self):
        r = await self.client.get("/api/v1/admin/comments", params={"limit": 200}, headers=self._auth("admin"))
        self.assertEqual(r.status_code, 200, r.text)
        emails = {c.get("author_email") for c in r.json()["comments"]}
        self.assertIn(self.emails["commenter"], emails)

    async def test_admin_comment_list_is_admin_only(self):
        for who in ("anonymous", "commenter", "author"):
            with self.subTest(caller=who):
                r = await self.client.get("/api/v1/admin/comments", headers=self._auth(who))
                self.assertIn(r.status_code, (401, 403), r.text)


if __name__ == "__main__":
    unittest.main()
