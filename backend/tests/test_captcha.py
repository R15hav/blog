"""hCaptcha contract tests for POST /auth/register and POST /auth/jwt/login.

Run from backend/:
    uv run python -m unittest tests.test_captcha -v

Mocked tests need no network. The opt-in live test calls api.hcaptcha.com with
hCaptcha's published public test credentials (never a real secret):
    PAPER_TEST_HCAPTCHA_LIVE=1 uv run python -m unittest tests.test_captcha.LiveHcaptchaTests -v
"""
import contextlib
import os
import sys
import unittest
import uuid
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import httpx  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from sqlalchemy import func, select, update  # noqa: E402

from app.app import app  # noqa: E402
from app.core.users import UserManager  # noqa: E402
from app.database.db import User, async_session_maker, create_db_and_tables, engine  # noqa: E402
from app.services.captcha import verify_hcaptcha  # noqa: E402
from app.services.site_settings import update_site_config  # noqa: E402

PASSWORD = "Captcha-Test-Passw0rd!"
MOCK_SECRET = "mock-secret"
GOOD = "good-token"
DEFAULT_VERIFY_URL = "https://api.hcaptcha.com/siteverify"
# hCaptcha's published public test credentials (from their documentation).
HCAPTCHA_TEST_SECRET = "0x0000000000000000000000000000000000000000"
HCAPTCHA_TEST_TOKEN = "10000000-aaaa-bbbb-cccc-000000000001"

_UNSET = object()
_REQUEST = httpx.Request("POST", DEFAULT_VERIFY_URL)


class _FakeCaptchaResponse:
    def __init__(self, success, error_codes=None):
        self._success = success
        self._codes = error_codes

    def raise_for_status(self):
        return None

    def json(self):
        codes = self._codes
        if codes is None:
            codes = [] if self._success else ["invalid-input-response"]
        return {"success": self._success, "error-codes": codes}


def fake_captcha_client(*, success=True, error_codes=None, raises=None, response=None):
    """Patch target for app.services.captcha.httpx.AsyncClient.

    Returns (client_class, calls, init_kwargs); calls holds (url, data) tuples.
    """
    calls = []
    init_kwargs = []

    class _Client:
        def __init__(self, *a, **kw):
            init_kwargs.append(kw)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, data=None):
            calls.append((url, data))
            if raises is not None:
                raise raises
            if response is not None:
                return response
            return _FakeCaptchaResponse(success, error_codes)

    return _Client, calls, init_kwargs


def _upstream_failures():
    return {
        "timeout": dict(raises=httpx.ReadTimeout("timeout")),
        "connect error": dict(raises=httpx.ConnectError("refused")),
        "http 500": dict(response=httpx.Response(500, json={"success": True}, request=_REQUEST)),
        "non-json": dict(response=httpx.Response(200, text="not json", request=_REQUEST)),
    }


class CaptchaContractTests(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        await create_db_and_tables()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.suffix = uuid.uuid4().hex[:8]
        async with async_session_maker() as s:
            await update_site_config(s, allow_registration=True)
        self.env = mock.patch.dict(os.environ, {"HCAPTCHA_ENABLED": "false"})
        self.env.start()
        os.environ.pop("HCAPTCHA_SECRET", None)
        os.environ.pop("HCAPTCHA_VERIFY_URL", None)

    async def asyncTearDown(self):
        self.env.stop()
        async with async_session_maker() as s:
            await update_site_config(s, allow_registration=True)
        await self.client.aclose()
        await engine.dispose()

    # ── helpers ────────────────────────────────────────────────────────────────

    def _email(self, local):
        return f"{local}+captcha-{self.suffix}@example.com"

    async def _register(self, email, token=_UNSET):
        body = {"email": email, "password": PASSWORD}
        if token is not _UNSET:
            body["hcaptcha_token"] = token
        return await self.client.post("/auth/register", json=body)

    async def _login(self, email, password=PASSWORD, token=_UNSET):
        data = {"username": email, "password": password}
        if token is not _UNSET:
            data["hcaptcha_token"] = token
        return await self.client.post("/auth/jwt/login", data=data)

    async def _users_matching(self, email):
        async with async_session_maker() as s:
            rows = await s.execute(select(User).where(func.lower(User.email) == email.lower()))
            return rows.scalars().all()

    async def _active_user(self, local="login"):
        email = self._email(local)
        r = await self._register(email)  # captcha disabled here
        self.assertEqual(r.status_code, 201, r.text)
        async with async_session_maker() as s:
            await s.execute(update(User).where(User.email == email).values(is_active=True))
            await s.commit()
        return email

    @contextlib.contextmanager
    def _captcha(self, client_cls, secret=MOCK_SECRET):
        env = {"HCAPTCHA_ENABLED": "true"}
        if secret is not None:
            env["HCAPTCHA_SECRET"] = secret
        with mock.patch.dict(os.environ, env):
            if secret is None:
                os.environ.pop("HCAPTCHA_SECRET", None)
            os.environ.pop("HCAPTCHA_VERIFY_URL", None)
            with mock.patch("app.services.captcha.httpx.AsyncClient", client_cls):
                yield

    @contextlib.contextmanager
    def _auth_spy(self):
        with mock.patch.object(UserManager, "authenticate", autospec=True,
                               side_effect=UserManager.authenticate) as spy:
            yield spy

    # ── disabled ───────────────────────────────────────────────────────────────

    async def test_disabled_needs_no_token(self):
        client_cls, calls, _ = fake_captcha_client()
        email = await self._active_user("disabled")
        with self._captcha(client_cls):
            os.environ["HCAPTCHA_ENABLED"] = "false"
            r = await self._register(self._email("new-disabled"))
            self.assertEqual(r.status_code, 201, r.text)
            r = await self._login(email)
            self.assertEqual(r.status_code, 200, r.text)
            self.assertTrue(r.json()["access_token"])
        self.assertEqual(calls, [])

    # ── missing / empty token ──────────────────────────────────────────────────

    async def test_missing_or_empty_token(self):
        email = await self._active_user("missing")
        for label, token in (("missing", _UNSET), ("empty", "")):
            with self.subTest(token=label):
                client_cls, calls, _ = fake_captcha_client()
                new_email = self._email(f"new-{label}")
                with self._captcha(client_cls), self._auth_spy() as spy:
                    r = await self._register(new_email, token)
                    self.assertEqual(r.status_code, 400, r.text)
                    self.assertEqual(r.json()["detail"], "CAPTCHA token missing")
                    r = await self._login(email, token=token)
                    self.assertEqual(r.status_code, 400, r.text)
                    self.assertEqual(r.json()["detail"], "CAPTCHA token missing")
                    spy.assert_not_awaited()
                self.assertEqual(calls, [])
                self.assertEqual(await self._users_matching(new_email), [])

    # ── misconfigured secret ───────────────────────────────────────────────────

    async def test_missing_or_blank_secret(self):
        email = await self._active_user("nosecret")
        for label, secret in (("unset", None), ("blank", "   ")):
            with self.subTest(secret=label):
                client_cls, calls, _ = fake_captcha_client()
                new_email = self._email(f"new-{label}")
                with self._captcha(client_cls, secret=secret):
                    with self.assertLogs("app.services.captcha", "ERROR"):
                        r = await self._register(new_email, GOOD)
                    self.assertEqual(r.status_code, 500, r.text)
                    self.assertEqual(r.json()["detail"], "CAPTCHA misconfigured")
                    with self.assertLogs("app.services.captcha", "ERROR"):
                        r = await self._login(email, token=GOOD)
                    self.assertEqual(r.status_code, 500, r.text)
                    self.assertEqual(r.json()["detail"], "CAPTCHA misconfigured")
                self.assertEqual(calls, [])
                self.assertEqual(await self._users_matching(new_email), [])

    # ── invalid / valid token ──────────────────────────────────────────────────

    async def test_invalid_token(self):
        email = await self._active_user("invalid")
        client_cls, calls, _ = fake_captcha_client(success=False, error_codes=["invalid-input-response"])
        new_email = self._email("new-invalid")
        expected = {"code": "CAPTCHA_INVALID", "error-codes": ["invalid-input-response"]}
        with self._captcha(client_cls), self._auth_spy() as spy:
            r = await self._register(new_email, "bad")
            self.assertEqual(r.status_code, 400, r.text)
            self.assertEqual(r.json()["detail"], expected)
            r = await self._login(email, token="bad")
            self.assertEqual(r.status_code, 400, r.text)
            self.assertEqual(r.json()["detail"], expected)
            spy.assert_not_awaited()
        self.assertEqual(len(calls), 2)
        self.assertEqual(await self._users_matching(new_email), [])

    async def test_valid_token(self):
        email = await self._active_user("valid")
        client_cls, _, _ = fake_captcha_client(success=True)
        new_email = self._email("new-valid")
        with self._captcha(client_cls):
            r = await self._register(new_email, GOOD)
            self.assertEqual(r.status_code, 201, r.text)
            self.assertFalse(r.json()["is_active"])
            r = await self._login(email, token=GOOD)
            self.assertEqual(r.status_code, 200, r.text)
            self.assertTrue(r.json()["access_token"])
        users = await self._users_matching(new_email)
        self.assertEqual(len(users), 1)
        self.assertFalse(users[0].is_active)

    # ── upstream failures ──────────────────────────────────────────────────────

    async def test_upstream_failures_fail_closed(self):
        email = await self._active_user("upstream")
        for label, kwargs in _upstream_failures().items():
            with self.subTest(failure=label):
                client_cls, calls, _ = fake_captcha_client(**kwargs)
                new_email = self._email(f"new-{label.replace(' ', '-')}")
                with self._captcha(client_cls), self._auth_spy() as spy:
                    r = await self._register(new_email, GOOD)
                    self.assertEqual(r.status_code, 503, r.text)
                    self.assertEqual(r.json()["detail"], "CAPTCHA verification unavailable")
                    r = await self._login(email, token=GOOD)
                    self.assertEqual(r.status_code, 503, r.text)
                    self.assertEqual(r.json()["detail"], "CAPTCHA verification unavailable")
                    spy.assert_not_awaited()
                self.assertEqual(len(calls), 2)
                self.assertEqual(await self._users_matching(new_email), [])

    # ── ordering ───────────────────────────────────────────────────────────────

    async def test_login_captcha_runs_before_credentials(self):
        email = await self._active_user("order")
        client_cls, _, _ = fake_captcha_client(success=False)
        with self._captcha(client_cls), self._auth_spy() as spy:
            r = await self._login(email, password="Wrong-Passw0rd!", token="bad")
            self.assertEqual(r.status_code, 400, r.text)
            self.assertEqual(r.json()["detail"]["code"], "CAPTCHA_INVALID")
            self.assertNotIn("LOGIN_BAD_CREDENTIALS", r.text)
            spy.assert_not_awaited()

    async def test_closed_registration_rejects_before_captcha(self):
        async with async_session_maker() as s:
            await update_site_config(s, allow_registration=False)
        client_cls, calls, _ = fake_captcha_client()
        new_email = self._email("new-closed")
        with self._captcha(client_cls):
            r = await self._register(new_email, GOOD)
        self.assertEqual(r.status_code, 403, r.text)
        self.assertEqual(r.json()["detail"], "Registration is currently closed.")
        self.assertEqual(calls, [])
        self.assertEqual(await self._users_matching(new_email), [])

    # ── payload ────────────────────────────────────────────────────────────────

    async def test_verify_payload_timeout_and_url(self):
        email = await self._active_user("payload")
        for label in ("register", "login"):
            with self.subTest(endpoint=label):
                client_cls, calls, init_kwargs = fake_captcha_client()
                with self._captcha(client_cls):
                    if label == "register":
                        r = await self._register(self._email("new-payload"), GOOD)
                        self.assertEqual(r.status_code, 201, r.text)
                    else:
                        r = await self._login(email, token=GOOD)
                        self.assertEqual(r.status_code, 200, r.text)
                self.assertEqual(len(calls), 1)
                url, data = calls[0]
                self.assertEqual(url, DEFAULT_VERIFY_URL)
                self.assertEqual(data["secret"], MOCK_SECRET)
                self.assertEqual(data["response"], GOOD)
                self.assertTrue(data.get("remoteip"))
                self.assertEqual(init_kwargs, [{"timeout": 5.0}])


@unittest.skipUnless(
    os.getenv("PAPER_TEST_HCAPTCHA_LIVE") == "1",
    "set PAPER_TEST_HCAPTCHA_LIVE=1 to call api.hcaptcha.com with the public test credentials",
)
class LiveHcaptchaTests(unittest.IsolatedAsyncioTestCase):
    """No mocks: talks to the real hCaptcha service with the public test secret."""

    def setUp(self):
        self.env = mock.patch.dict(
            os.environ, {"HCAPTCHA_ENABLED": "true", "HCAPTCHA_SECRET": HCAPTCHA_TEST_SECRET}
        )
        self.env.start()
        os.environ.pop("HCAPTCHA_VERIFY_URL", None)

    def tearDown(self):
        self.env.stop()

    async def test_official_test_token_is_accepted(self):
        self.assertIsNone(await verify_hcaptcha(HCAPTCHA_TEST_TOKEN))

    async def test_other_token_is_rejected(self):
        with self.assertRaises(HTTPException) as cm:
            await verify_hcaptcha("not-a-real-token")
        self.assertEqual(cm.exception.status_code, 400)
        detail = cm.exception.detail
        self.assertEqual(detail["code"], "CAPTCHA_INVALID")
        self.assertIn("invalid-input-response", detail["error-codes"])


if __name__ == "__main__":
    unittest.main()
