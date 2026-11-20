"""Tests for #59: access control, validation and serving of POST /api/v1/admin/upload-logo.

Run from backend/:
    uv run python -m unittest tests.test_logo_upload -v

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
from sqlalchemy import func, select, update  # noqa: E402

import app.api.v1.admin as admin_module  # noqa: E402
from app.app import UploadsStaticFiles, app  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402

PASSWORD = "LogoUpload-Test-Passw0rd!"
UPLOAD_URL = "/api/v1/admin/upload-logo"
DETAIL_415 = "Upload a PNG, JPEG or WebP image."
DETAIL_413 = "Logo must be 5 MB or smaller."
CSP = "default-src 'none'; sandbox"

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)
REAL_UPLOADS_DIR = admin_module.UPLOADS_DIR  # captured before any test patches it
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
WEBP = b"RIFF" + b"\x24\x00\x00\x00" + b"WEBP" + b"\x00" * 32


class LogoUploadTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = self._tmp.name
        self.patch = mock.patch.object(admin_module, "UPLOADS_DIR", self.tmp)
        self.patch.start()
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
        self.guest_headers = await self._auth(self.guest)
        self.author_headers = await self._auth(self.author)
        author_id = await self._user_id(self.author)
        r = await self.client.patch(f"/api/v1/admin/users/{author_id}/role",
                                    json={"role": "author"}, headers=self.admin_headers)
        self.assertEqual(r.status_code, 200, r.text)

    async def asyncTearDown(self):
        self.env.stop()
        self.patch.stop()
        async with async_session_maker() as s:
            # Leave no superuser behind for other test modules sharing this database.
            await s.execute(update(User).where(func.lower(User.email) == self.admin.lower())
                            .values(is_superuser=False))
            await s.commit()
        await self.client.aclose()
        await engine.dispose()
        self._tmp.cleanup()

    def _email(self, local):
        return f"{local}+{self.suffix}@example.com"

    async def _auth(self, email):
        r = await self.client.post("/auth/jwt/login", data={"username": email, "password": PASSWORD})
        self.assertEqual(r.status_code, 200, r.text)
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    async def _user_id(self, email):
        async with async_session_maker() as s:
            return str((await s.execute(select(User.id).where(func.lower(User.email) == email.lower()))).scalar_one())

    async def _upload(self, content, filename="logo.png", content_type="image/png", headers=None):
        headers = self.admin_headers if headers is None else headers
        return await self.client.post(
            UPLOAD_URL, files={"file": (filename, content, content_type)}, headers=headers)

    def _files(self):
        return os.listdir(self.tmp)

    def _png_of_size(self, size):
        return PNG + b"\x00" * (size - len(PNG))

    # ── Authorization (1–3) ───────────────────────────────────────────────────

    async def test_signed_out_gets_401_and_writes_nothing(self):
        r = await self._upload(PNG, headers={})
        self.assertEqual(r.status_code, 401)
        self.assertEqual(self._files(), [])

    async def test_guest_gets_403_and_writes_nothing(self):
        r = await self._upload(PNG, headers=self.guest_headers)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self._files(), [])

    async def test_author_gets_403_and_writes_nothing(self):
        r = await self._upload(PNG, headers=self.author_headers)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self._files(), [])

    # ── Accepted uploads (4–6, 11–12, 15) ─────────────────────────────────────

    async def test_admin_png_upload(self):
        r = await self._upload(PNG)
        self.assertEqual(r.status_code, 200, r.text)
        url = r.json()["url"]
        self.assertRegex(url, r"^/uploads/logo_[0-9a-f]{32}\.png$")
        with open(os.path.join(self.tmp, url.rsplit("/", 1)[1]), "rb") as f:
            self.assertEqual(f.read(), PNG)

    async def test_admin_jpeg_and_webp_extensions(self):
        r = await self._upload(JPEG, "photo.jpeg", "image/jpeg")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertRegex(r.json()["url"], r"^/uploads/logo_[0-9a-f]{32}\.jpg$")
        r = await self._upload(WEBP, "photo.webp", "image/webp")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertRegex(r.json()["url"], r"^/uploads/logo_[0-9a-f]{32}\.webp$")

    async def test_client_name_and_type_are_ignored(self):
        r = await self._upload(PNG, "image.txt", "text/plain")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertRegex(r.json()["url"], r"^/uploads/logo_[0-9a-f]{32}\.png$")

    async def test_exactly_max_size_is_accepted(self):
        r = await self._upload(self._png_of_size(admin_module.LOGO_MAX_BYTES))
        self.assertEqual(r.status_code, 200, r.text)

    async def test_traversal_filename_stays_inside_uploads_dir(self):
        r = await self._upload(PNG, "../../evil.png")
        self.assertEqual(r.status_code, 200, r.text)
        url = r.json()["url"]
        self.assertRegex(url, r"^/uploads/logo_[0-9a-f]{32}\.png$")
        files = self._files()
        self.assertEqual(files, [url.rsplit("/", 1)[1]])
        self.assertTrue(os.path.realpath(os.path.join(self.tmp, files[0])).startswith(os.path.realpath(self.tmp) + os.sep))
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "..", "..", "evil.png")))

    async def test_uploads_never_overwrite(self):
        r1 = await self._upload(PNG, "logo.png")
        r2 = await self._upload(JPEG, "logo.png")
        self.assertEqual(r1.status_code, 200, r1.text)
        self.assertEqual(r2.status_code, 200, r2.text)
        self.assertNotEqual(r1.json()["url"], r2.json()["url"])
        self.assertEqual(len(self._files()), 2)
        with open(os.path.join(self.tmp, r1.json()["url"].rsplit("/", 1)[1]), "rb") as f:
            self.assertEqual(f.read(), PNG)

    async def test_existing_file_is_not_overwritten_on_name_collision(self):
        fixed = uuid.UUID(int=1)
        with open(os.path.join(self.tmp, f"logo_{fixed.hex}.png"), "wb") as f:
            f.write(b"original")
        with mock.patch.object(admin_module._uuid, "uuid4", return_value=fixed):
            with self.assertRaises(FileExistsError):
                await self._upload(PNG)
        with open(os.path.join(self.tmp, f"logo_{fixed.hex}.png"), "rb") as f:
            self.assertEqual(f.read(), b"original")

    # ── Rejected uploads (7–10) ───────────────────────────────────────────────

    async def test_text_with_image_name_and_type_is_rejected(self):
        r = await self._upload(b"just some text", "logo.png", "image/png")
        self.assertEqual(r.status_code, 415)
        self.assertEqual(r.json(), {"detail": DETAIL_415})
        self.assertEqual(self._files(), [])

    async def test_svg_is_rejected(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        r = await self._upload(svg, "logo.svg", "image/svg+xml")
        self.assertEqual(r.status_code, 415)
        self.assertEqual(r.json(), {"detail": DETAIL_415})
        self.assertEqual(self._files(), [])

    async def test_gif_is_rejected(self):
        r = await self._upload(b"GIF89a" + b"\x00" * 32, "logo.gif", "image/gif")
        self.assertEqual(r.status_code, 415)
        self.assertEqual(r.json(), {"detail": DETAIL_415})
        self.assertEqual(self._files(), [])

    async def test_riff_that_is_not_webp_is_rejected(self):
        r = await self._upload(b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 16, "a.webp", "image/webp")
        self.assertEqual(r.status_code, 415)
        self.assertEqual(self._files(), [])

    async def test_empty_file_is_rejected(self):
        r = await self._upload(b"")
        self.assertEqual(r.status_code, 415)
        self.assertEqual(r.json(), {"detail": DETAIL_415})
        self.assertEqual(self._files(), [])

    async def test_oversized_file_is_rejected_and_not_written(self):
        r = await self._upload(self._png_of_size(admin_module.LOGO_MAX_BYTES + 1))
        self.assertEqual(r.status_code, 413)
        self.assertEqual(r.json(), {"detail": DETAIL_413})
        self.assertEqual(self._files(), [])

    # ── Serving headers (13–14) ───────────────────────────────────────────────

    def _static_client(self):
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=UploadsStaticFiles(directory=self.tmp)), base_url="http://t")

    async def test_uploaded_file_is_served_with_security_headers(self):
        r = await self._upload(PNG, "logo.png")
        name = r.json()["url"].rsplit("/", 1)[1]
        async with self._static_client() as static:
            got = await static.get(f"/{name}")
        self.assertEqual(got.status_code, 200)
        self.assertEqual(got.content, PNG)
        self.assertEqual(got.headers["content-type"], "image/png")
        self.assertEqual(got.headers["x-content-type-options"], "nosniff")
        self.assertEqual(got.headers["content-security-policy"], CSP)

    async def test_legacy_file_is_served_with_security_headers(self):
        with open(os.path.join(self.tmp, "logo_legacy.txt"), "wb") as f:
            f.write(b"<script>alert(1)</script>")
        async with self._static_client() as static:
            got = await static.get("/logo_legacy.txt")
        self.assertEqual(got.status_code, 200)
        self.assertEqual(got.headers["x-content-type-options"], "nosniff")
        self.assertEqual(got.headers["content-security-policy"], CSP)

    async def test_app_mount_uses_uploads_static_files_on_uploads_dir(self):
        mount = next(r for r in app.routes if getattr(r, "name", None) == "uploads")
        self.assertIsInstance(mount.app, UploadsStaticFiles)
        self.assertEqual(os.path.realpath(mount.app.directory), os.path.realpath(REAL_UPLOADS_DIR))


if __name__ == "__main__":
    unittest.main()
