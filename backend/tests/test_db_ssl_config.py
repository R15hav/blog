"""Tests for PostgreSQL URL / sslmode handling shared by the app and Alembic.

Run from backend/:
    uv run python -m unittest discover -s tests -v

The driver-level tests replace asyncpg.connect with a spy, so no database is
needed. The optional live test runs only when PAPER_TEST_POSTGRES_URL points at
a disposable PostgreSQL server WITHOUT SSL, e.g.
    PAPER_TEST_POSTGRES_URL=postgresql://user:pass@127.0.0.1:55432/db
"""
import asyncio
import json
import os
import ssl
import subprocess
import sys
import textwrap
import unittest
from unittest import mock
from urllib.parse import parse_qsl, urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)

import asyncpg  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from app.database.connection import DEFAULT_SSLMODE, database_settings  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PG = "postgresql://blog_user:blog_pass@db.internal:5432/blog_db"


def describe_ssl(value):
    """Comparable summary of asyncpg's ``ssl`` argument."""
    if isinstance(value, ssl.SSLContext):
        return f"context(verify_mode={value.verify_mode.name}, check_hostname={value.check_hostname})"
    return repr(value)


class _Captured(Exception):
    pass


async def driver_kwargs(settings):
    """Connect through a real SQLAlchemy async engine and capture what asyncpg receives."""
    seen = {}

    async def spy(*args, **kwargs):
        seen.update(kwargs)
        raise _Captured

    engine = create_async_engine(settings.url, connect_args=settings.connect_args)
    try:
        with mock.patch.object(asyncpg, "connect", spy):
            with _expect_raised(_Captured):
                async with engine.connect():
                    pass
    finally:
        await engine.dispose()
    return seen


class _expect_raised:
    def __init__(self, exc):
        self.exc = exc

    def __enter__(self):
        return self

    def __exit__(self, et, ev, tb):
        if et is None:
            raise AssertionError(f"{self.exc.__name__} not raised")
        return issubclass(et, self.exc)


class SslModeResolutionTests(unittest.TestCase):

    def test_disable_turns_ssl_off(self):
        s = database_settings(PG + "?sslmode=disable")
        self.assertEqual(s.sslmode, "disable")
        self.assertIs(s.connect_args["ssl"], False)

    def test_prefer_is_passed_to_asyncpg_as_prefer(self):
        s = database_settings(PG + "?sslmode=prefer")
        self.assertEqual(s.sslmode, "prefer")
        self.assertEqual(s.connect_args["ssl"], "prefer")

    def test_require_is_mandatory_unverified_tls(self):
        s = database_settings(PG + "?sslmode=require")
        ctx = s.connect_args["ssl"]
        self.assertIsInstance(ctx, ssl.SSLContext)
        self.assertEqual(ctx.verify_mode, ssl.CERT_NONE)
        self.assertFalse(ctx.check_hostname)

    def test_missing_sslmode_keeps_previous_required_ssl_default(self):
        self.assertEqual(DEFAULT_SSLMODE, "require")
        s = database_settings(PG)
        self.assertEqual(s.sslmode, "require")
        self.assertEqual(describe_ssl(s.connect_args["ssl"]),
                         describe_ssl(database_settings(PG + "?sslmode=require").connect_args["ssl"]))

    def test_verify_modes_are_delegated_to_asyncpg(self):
        for mode in ("allow", "verify-ca", "verify-full"):
            self.assertEqual(database_settings(f"{PG}?sslmode={mode}").connect_args["ssl"], mode)

    def test_mode_value_is_case_insensitive(self):
        self.assertIs(database_settings(PG + "?sslmode=DISABLE").connect_args["ssl"], False)

    def test_connect_timeout_is_kept(self):
        for q in ("", "?sslmode=disable", "?sslmode=prefer"):
            self.assertEqual(database_settings(PG + q).connect_args["timeout"], 10)

    def test_legacy_ssl_param_is_an_alias(self):
        self.assertEqual(database_settings(PG + "?ssl=true").sslmode, "require")
        self.assertEqual(database_settings(PG + "?ssl=false").sslmode, "disable")
        self.assertEqual(database_settings(PG + "?ssl=require&sslmode=require").sslmode, "require")

    def test_unknown_or_conflicting_values_fail_instead_of_downgrading(self):
        for q in ("?sslmode=off", "?sslmode=", "?ssl=maybe", "?sslmode=require&ssl=false",
                  "?sslmode=disable&sslmode=require"):
            with self.subTest(q=q), self.assertRaises(ValueError):
                database_settings(PG + q)

    def test_every_postgres_scheme_is_normalised_to_asyncpg(self):
        for scheme in ("postgres", "postgresql", "postgresql+asyncpg", "PostgreSQL"):
            s = database_settings(f"{scheme}://u:p@h:5432/d?sslmode=disable")
            self.assertEqual(s.url, "postgresql+asyncpg://u:p@h:5432/d")
            self.assertIs(s.connect_args["ssl"], False)


class NonPostgresTests(unittest.TestCase):

    def test_sqlite_urls_are_untouched(self):
        for url in ("sqlite+aiosqlite:///./test.db", "sqlite+aiosqlite:////tmp/x.db?sslmode=require"):
            s = database_settings(url)
            self.assertEqual(s.url, url)
            self.assertEqual(s.connect_args, {})
            self.assertIsNone(s.sslmode)


class UrlPreservationTests(unittest.TestCase):

    def test_unrelated_parameters_and_credentials_are_preserved(self):
        raw = ("postgres://blog%40user:p%40ss%2Fw0rd@db.example:6543/blog_db"
               "?application_name=paper&sslmode=disable&options=-c%20statement_timeout%3D5000"
               "&target_session_attrs=read-write&empty=")
        s = database_settings(raw)
        out = urlsplit(s.url)
        self.assertEqual(out.scheme, "postgresql+asyncpg")
        self.assertEqual(out.netloc, "blog%40user:p%40ss%2Fw0rd@db.example:6543")
        self.assertEqual(out.path, "/blog_db")
        self.assertEqual(parse_qsl(out.query, keep_blank_values=True), [
            ("application_name", "paper"),
            ("options", "-c statement_timeout=5000"),
            ("target_session_attrs", "read-write"),
            ("empty", ""),
        ])
        self.assertNotIn("sslmode", s.url)

    def test_repeated_unrelated_parameters_are_kept(self):
        s = database_settings(PG + "?host=a&host=b&sslmode=disable")
        self.assertEqual(parse_qsl(urlsplit(s.url).query), [("host", "a"), ("host", "b")])


class DriverArgumentTests(unittest.IsolatedAsyncioTestCase):
    """What asyncpg.connect() actually receives through SQLAlchemy's asyncpg dialect."""

    async def test_driver_receives_translated_ssl_and_no_sslmode_keyword(self):
        cases = {
            "?sslmode=disable": "False",
            "?sslmode=prefer": "'prefer'",
            "?sslmode=require": "context(verify_mode=CERT_NONE, check_hostname=False)",
            "": "context(verify_mode=CERT_NONE, check_hostname=False)",
        }
        for query, expected in cases.items():
            with self.subTest(query=query or "<absent>"):
                kw = await driver_kwargs(database_settings(PG + query))
                self.assertEqual(describe_ssl(kw["ssl"]), expected)
                self.assertEqual(kw["timeout"], 10)
                self.assertNotIn("sslmode", kw)
                self.assertEqual((kw["host"], kw["port"], kw["user"], kw["database"]),
                                 ("db.internal", 5432, "blog_user", "blog_db"))

    async def test_postgresql_asyncpg_url_with_sslmode_reaches_driver_cleanly(self):
        # Previously postgresql+asyncpg:// URLs skipped normalisation, so
        # ?sslmode= would have reached asyncpg.connect() as an unknown keyword.
        kw = await driver_kwargs(database_settings(
            "postgresql+asyncpg://u:p@h:5432/d?sslmode=disable&command_timeout=30"))
        self.assertIs(kw["ssl"], False)
        self.assertNotIn("sslmode", kw)
        self.assertIn("command_timeout", kw)


# Runs in a subprocess so DATABASE_URL is read fresh by app.database.db and by
# alembic/env.py, exactly as at container start-up.
_PROBE = textwrap.dedent("""
    import asyncio, json, ssl, sys
    import asyncpg
    from alembic import command
    from alembic.config import Config

    def describe(kw):
        v = kw["ssl"]
        s = (f"context(verify_mode={v.verify_mode.name}, check_hostname={v.check_hostname})"
             if isinstance(v, ssl.SSLContext) else repr(v))
        return {"ssl": s, **{k: kw[k] for k in ("host", "port", "user", "password", "database", "timeout")},
                "keys": sorted(kw)}

    seen = {}
    class Stop(Exception):
        pass
    def spy_for(name):
        async def spy(*a, **kw):
            seen[name] = describe(kw)
            raise Stop
        return spy

    from app.database.db import engine
    async def app_connect():
        asyncpg.connect = spy_for("app")
        try:
            async with engine.connect():
                pass
        except Stop:
            pass
    asyncio.run(app_connect())

    asyncpg.connect = spy_for("alembic")
    try:
        command.upgrade(Config("alembic.ini"), "head")
    except Stop:
        pass
    print(json.dumps(seen))
""")


class AppAndAlembicAgreeTests(unittest.TestCase):

    def _probe(self, url):
        env = {**os.environ, "DATABASE_URL": url}
        env.pop("PGSSLMODE", None)
        out = subprocess.run([sys.executable, "-c", _PROBE], cwd=BACKEND_DIR, env=env,
                             capture_output=True, text=True, timeout=120)
        self.assertEqual(out.returncode, 0, out.stderr[-2000:])
        return json.loads(out.stdout.strip().splitlines()[-1])

    def test_application_and_alembic_pass_identical_driver_arguments(self):
        cases = {
            "?sslmode=disable": "False",
            "?sslmode=prefer": "'prefer'",
            "?sslmode=require": "context(verify_mode=CERT_NONE, check_hostname=False)",
            "": "context(verify_mode=CERT_NONE, check_hostname=False)",
        }
        for query, expected in cases.items():
            with self.subTest(query=query or "<absent>"):
                seen = self._probe(PG + query)
                self.assertIn("app", seen)
                self.assertIn("alembic", seen)
                self.assertEqual(seen["app"], seen["alembic"])
                self.assertEqual(seen["app"]["ssl"], expected)
                self.assertNotIn("sslmode", seen["app"]["keys"])

    def test_percent_encoded_credentials_survive_alembic_config(self):
        # alembic.Config is a ConfigParser: an unescaped '%' in sqlalchemy.url
        # raises "invalid interpolation syntax". env.py escapes it as '%%'.
        seen = self._probe("postgresql://blog_user:p%40ss%2Fw%25rd@db.internal:5432/blog_db?sslmode=disable")
        self.assertEqual(seen["app"], seen["alembic"])
        self.assertEqual(seen["alembic"]["password"], "p@ss/w%rd")


@unittest.skipUnless(os.getenv("PAPER_TEST_POSTGRES_URL"), "set PAPER_TEST_POSTGRES_URL to a disposable non-SSL PostgreSQL")
class LivePostgresWithoutSslTests(unittest.IsolatedAsyncioTestCase):

    def _url(self, mode):
        base = os.environ["PAPER_TEST_POSTGRES_URL"]
        return f"{base}{'&' if '?' in base else '?'}sslmode={mode}"

    async def _connection_uses_ssl(self, mode):
        s = database_settings(self._url(mode))
        engine = create_async_engine(s.url, connect_args=s.connect_args)
        try:
            async with engine.connect() as conn:
                return (await conn.execute(text("select ssl from pg_stat_ssl where pid = pg_backend_pid()"))).scalar()
        finally:
            await engine.dispose()

    async def test_disable_connects_without_ssl(self):
        self.assertIs(await self._connection_uses_ssl("disable"), False)

    async def test_prefer_falls_back_to_plain_connection(self):
        self.assertIs(await self._connection_uses_ssl("prefer"), False)

    async def test_require_is_not_silently_downgraded(self):
        with self.assertRaises(Exception) as cm:
            await self._connection_uses_ssl("require")
        self.assertIn("SSL", str(cm.exception))


if __name__ == "__main__":
    unittest.main()
