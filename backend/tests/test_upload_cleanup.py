"""Tests for #88: replaced/cleared logo and OG image uploads are deleted.

Run from backend/:
    uv run python -m unittest tests.test_upload_cleanup -v

Uses the shared throwaway SQLite database, fictional example.com accounts and a
temporary uploads directory (app.api.v1.admin.UPLOADS_DIR is patched).
"""
import os
import sys
import tempfile
import unittest
import uuid
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import httpx  # noqa: E402
from sqlalchemy import func, update  # noqa: E402

import app.api.v1.admin as admin_module  # noqa: E402
from app.app import app  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.site_settings import get_site_config, update_site_config  # noqa: E402

PASSWORD = "UploadCleanup-Test-Passw0rd!"
SETTINGS_URL = "/api/v1/admin/settings"

A = f"logo_{'a' * 32}.png"
B = f"logo_{'b' * 32}.png"
C = f"logo_{'c' * 32}.png"
D = f"logo_{'d' * 32}.png"
CUSTOM = "custom.png"


class UploadCleanupTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = os.path.join(self._tmp.name, "uploads")
        self.outside = os.path.join(self._tmp.name, "outside")
        os.makedirs(self.tmp)
        os.makedirs(self.outside)
        self.patch = mock.patch.object(admin_module, "UPLOADS_DIR", self.tmp)
        self.patch.start()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("FIRST_ADMIN_EMAIL", None)

        async with async_session_maker() as s:
            cfg = await get_site_config(s)
            self._saved = (cfg.logo_url, cfg.og_image_url)
            await update_site_config(s, allow_registration=True)

        self.admin = f"admin+{uuid.uuid4().hex[:8]}@example.com"
        r = await self.client.post("/auth/register", json={"email": self.admin, "password": PASSWORD})
        self.assertEqual(r.status_code, 201, r.text)
        async with async_session_maker() as s:
            await s.execute(update(User).where(func.lower(User.email) == self.admin.lower())
                            .values(is_superuser=True, is_active=True, role="admin"))
            await s.commit()
        r = await self.client.post("/auth/jwt/login", data={"username": self.admin, "password": PASSWORD})
        self.assertEqual(r.status_code, 200, r.text)
        self.headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        for name in (A, B, C, CUSTOM):
            self._touch(name)

    async def asyncTearDown(self):
        async with async_session_maker() as s:
            cfg = await get_site_config(s)
            cfg.logo_url, cfg.og_image_url = self._saved
            s.add(cfg)
            await s.execute(update(User).where(func.lower(User.email) == self.admin.lower())
                            .values(is_superuser=False))
            await s.commit()
        self.env.stop()
        self.patch.stop()
        await self.client.aclose()
        await engine.dispose()
        self._tmp.cleanup()

    def _touch(self, name, directory=None):
        with open(os.path.join(directory or self.tmp, name), "wb") as f:
            f.write(b"x")

    def _files(self):
        return set(os.listdir(self.tmp))

    async def _put(self, **body):
        r = await self.client.put(SETTINGS_URL, json=body, headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    async def _set_raw(self, logo=None, og=None):
        """Set stored values directly, bypassing the endpoint (so nothing is cleaned up)."""
        async with async_session_maker() as s:
            cfg = await get_site_config(s)
            cfg.logo_url = logo
            cfg.og_image_url = og
            s.add(cfg)
            await s.commit()

    # 1
    async def test_replacing_logo_deletes_old_file(self):
        await self._set_raw(logo=f"/uploads/{A}")
        body = await self._put(logo_url=f"/uploads/{B}")
        self.assertEqual(body["logo_url"], f"/uploads/{B}")
        self.assertNotIn(A, self._files())
        self.assertIn(B, self._files())

    # 2
    async def test_file_still_used_by_og_image_is_kept(self):
        await self._set_raw(logo=f"/uploads/{B}", og=f"/uploads/{C}")
        await self._put(logo_url=f"/uploads/{C}")
        self.assertNotIn(B, self._files())
        self.assertIn(C, self._files())

    # 3
    async def test_absolute_dev_url_is_recognised(self):
        await self._set_raw(logo=f"http://localhost:8000/uploads/{A}")
        await self._put(logo_url=f"/uploads/{B}")
        self.assertNotIn(A, self._files())
        self.assertIn(B, self._files())

    # 4
    async def test_non_managed_name_is_kept(self):
        await self._set_raw(logo=f"/uploads/{CUSTOM}")
        await self._put(logo_url=f"/uploads/{B}")
        self.assertIn(CUSTOM, self._files())

    # 5
    async def test_external_url_deletes_nothing(self):
        await self._set_raw(logo="https://cdn.example.com/logo.png")
        before = self._files()
        await self._put(logo_url=f"/uploads/{B}")
        self.assertEqual(self._files(), before)

    # 6
    async def test_clearing_og_image_deletes_old_file(self):
        await self._set_raw(og=f"/uploads/{A}")
        body = await self._put(og_image_url="")
        self.assertIsNone(body["og_image_url"])
        self.assertNotIn(A, self._files())

    # 7
    async def test_unrelated_save_keeps_files(self):
        await self._set_raw(logo=f"/uploads/{A}")
        before = self._files()
        await self._put(site_name="Unrelated change")
        self.assertEqual(self._files(), before)

    # 8
    async def test_traversal_and_subdirectory_values_delete_nothing(self):
        app_py = os.path.join(self._tmp.name, "app.py")
        with open(app_py, "wb") as f:
            f.write(b"keep")
        os.makedirs(os.path.join(self.tmp, "sub"))
        self._touch(A, os.path.join(self.tmp, "sub"))
        before = self._files()
        for bad in ("/uploads/../app.py",
                    f"/uploads/sub/{A}",
                    f"/uploads/../outside/{A}",
                    f"/uploads/%2e%2e/{A}"):
            await self._set_raw(logo=bad)
            await self._put(logo_url=f"/uploads/{B}")
            self.assertEqual(self._files(), before, bad)
            self.assertTrue(os.path.exists(app_py), bad)
            self.assertTrue(os.path.exists(os.path.join(self.tmp, "sub", A)), bad)

    # 9
    async def test_missing_old_file_still_saves(self):
        await self._set_raw(logo=f"/uploads/logo_{'e' * 32}.png")
        body = await self._put(logo_url=f"/uploads/{B}")
        self.assertEqual(body["logo_url"], f"/uploads/{B}")

    # 10
    async def test_delete_failure_is_logged_and_save_succeeds(self):
        await self._set_raw(logo=f"/uploads/{A}")
        with mock.patch.object(admin_module.os, "remove", side_effect=PermissionError("denied")):
            with self.assertLogs(admin_module.logger, level="WARNING") as logs:
                body = await self._put(logo_url=f"/uploads/{B}")
        self.assertEqual(body["logo_url"], f"/uploads/{B}")
        self.assertTrue(any("Could not delete replaced upload" in m for m in logs.output))
        self.assertIn(A, self._files())

    # 11
    async def test_symlink_resolving_outside_uploads_is_refused(self):
        target = os.path.join(self.outside, "secret.png")
        with open(target, "wb") as f:
            f.write(b"secret")
        try:
            os.symlink(target, os.path.join(self.tmp, D))
        except (OSError, NotImplementedError):
            self.skipTest("symlinks not supported")
        await self._set_raw(logo=f"/uploads/{D}")
        with mock.patch.object(admin_module.os, "remove", wraps=os.remove) as remove:
            await self._put(logo_url=f"/uploads/{B}")
        remove.assert_not_called()
        self.assertTrue(os.path.exists(target))
        with open(target, "rb") as f:
            self.assertEqual(f.read(), b"secret")


if __name__ == "__main__":
    unittest.main()
