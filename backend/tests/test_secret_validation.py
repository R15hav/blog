"""Regression tests for #104: the backend refuses to start with a missing or weak
JWT SECRET, and tokens signed with the old public default are rejected.

Run from backend/:
    uv run python -m unittest discover -s tests -v
"""
import os
import secrets
import subprocess
import sys
import unittest
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402  (sets the valid test SECRET and a throwaway DATABASE_URL)

import httpx  # noqa: E402
import jwt  # noqa: E402
from sqlalchemy import update  # noqa: E402

from app.core.secret import (  # noqa: E402
    KNOWN_INSECURE_SECRETS, InsecureSecretError, validate_secret,
)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD_DEFAULT = "dev-secret-change-me"
OLD_PLACEHOLDER = "change-me-use-a-long-random-string-in-production"
# Exactly 32 chars and exactly 8 distinct, but not one chunk repeated.
DISTINCT_32 = "abcdefgh" * 3 + "hgfedcba"


class ValidateSecretTests(unittest.TestCase):

    def test_rejected_values(self):
        cases = {
            "unset": None,
            "empty": "",
            "whitespace": "   \t ",
            "old default": OLD_DEFAULT,
            "old .env.example placeholder": OLD_PLACEHOLDER,
            "mixed-case deny-list entry": "Change-Me",
            "padded deny-list entry": "  CHANGEME  ",
            "31 chars": "abcdefgh" * 3 + "abcdefg",
            "32 x 'a'": "a" * 32,
            "7 distinct chars": "abcdefg" * 5,
            "8-char chunk repeated 4x": "abcdefgh" * 4,
            "hex-looking 32-char chunk repeated 2x": secrets.token_hex(16) * 2,
            "two-char chunk repeated": "Zq" * 20,
        }
        for name, value in cases.items():
            with self.subTest(name):
                with self.assertRaises(InsecureSecretError) as ctx:
                    validate_secret(value)
                message = str(ctx.exception)
                self.assertIn("SECRET", message)
                self.assertIn("openssl rand -hex 32", message)
                if value and value.strip():
                    self.assertNotIn(value.strip(), message)

    def test_deny_list_is_lower_case(self):
        self.assertTrue(all(v == v.lower() for v in KNOWN_INSECURE_SECRETS))
        self.assertIn(OLD_DEFAULT, KNOWN_INSECURE_SECRETS)
        self.assertIn(OLD_PLACEHOLDER, KNOWN_INSECURE_SECRETS)

    def test_messages_never_disclose_the_secret(self):
        # A long, otherwise plausible value that fails only the repetition check.
        unit = secrets.token_hex(8)
        with self.assertRaises(InsecureSecretError) as ctx:
            validate_secret(unit * 4)
        self.assertNotIn(unit, str(ctx.exception))
        self.assertNotIn(unit[:8], str(ctx.exception))

    def test_accepted_values(self):
        for value in (secrets.token_hex(32), DISTINCT_32, _isolated_db.TEST_SECRET):
            with self.subTest(len(value)):
                self.assertEqual(validate_secret(value), value)


class StartupRefusalTests(unittest.TestCase):

    def _run(self, args, secret):
        env = {k: v for k, v in os.environ.items() if k != "SECRET"}
        if secret is not None:
            env["SECRET"] = secret
        return subprocess.run([sys.executable, *args], cwd=BACKEND_DIR, env=env,
                              capture_output=True, text=True, timeout=120)

    def test_check_command_rejects_unset_and_default(self):
        for secret in (None, OLD_DEFAULT):
            with self.subTest(secret=secret):
                proc = self._run(["-m", "app.core.secret"], secret)
                self.assertEqual(proc.returncode, 1, proc.stderr)
                self.assertIn("SECRET", proc.stderr)
                self.assertTrue(proc.stderr.startswith("ERROR:"), proc.stderr)
                if secret:
                    self.assertNotIn(secret, proc.stderr)

    def test_check_command_accepts_valid_secret(self):
        proc = self._run(["-m", "app.core.secret"], secrets.token_hex(32))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("SECRET OK", proc.stdout)

    def test_importing_the_app_with_the_default_secret_fails(self):
        proc = self._run(["-c", "import app.app"], OLD_DEFAULT)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("InsecureSecretError", proc.stderr)

    def test_importing_the_app_without_a_secret_fails(self):
        proc = self._run(["-c", "import app.app"], None)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("InsecureSecretError", proc.stderr)


class ForgedTokenTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        from app.app import app
        from app.database.db import create_db_and_tables
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")

    async def asyncTearDown(self):
        from app.database.db import engine
        await self.client.aclose()
        await engine.dispose()

    def _token(self, user_id, key):
        return jwt.encode(
            {"sub": str(user_id), "aud": ["fastapi-users:auth"],
             "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            key, algorithm="HS256")

    async def test_token_signed_with_old_default_is_rejected(self):
        from app.database.db import User, async_session_maker
        email = f"forgery+{uuid.uuid4().hex[:8]}@example.com"
        r = await self.client.post("/auth/register", json={"email": email, "password": "Forgery-Test-Passw0rd!"})
        self.assertEqual(r.status_code, 201, r.text)
        admin_id = r.json()["id"]
        async with async_session_maker() as s:
            await s.execute(update(User).where(User.id == uuid.UUID(admin_id))
                            .values(is_superuser=True, is_active=True, role="admin"))
            await s.commit()

        forged = await self.client.get(
            "/api/v1/admin/users", headers={"Authorization": f"Bearer {self._token(admin_id, OLD_DEFAULT)}"})
        self.assertEqual(forged.status_code, 401, forged.text)

        # Control: the same payload signed with the configured secret is accepted.
        genuine = await self.client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {self._token(admin_id, _isolated_db.TEST_SECRET)}"})
        self.assertEqual(genuine.status_code, 200, genuine.text)
        async with async_session_maker() as s:
            await s.execute(update(User).where(User.id == uuid.UUID(admin_id)).values(is_superuser=False))
            await s.commit()


if __name__ == "__main__":
    unittest.main()
