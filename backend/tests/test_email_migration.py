"""Migration tests for #55 (e7b2c4d9a1f0: case-insensitive email uniqueness).

Run from backend/:
    uv run python -m unittest discover -s tests -v

Alembic runs in a subprocess, as at container start-up, against a throwaway
database: a temp SQLite file always, and a temp PostgreSQL database when
PAPER_TEST_POSTGRES_URL is set (see _pg_temp.py). Accounts are fictional.
"""
import asyncio
import os
import subprocess
import sys
import tempfile
import unittest
import uuid
from contextlib import contextmanager

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _isolated_db  # noqa: E402,F401  (must run before any app import)
import _pg_temp  # noqa: E402

from fastapi_users.password import PasswordHelper  # noqa: E402
from sqlalchemy import insert, select, text  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from app.database.connection import database_settings  # noqa: E402
from app.database.db import User  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEFORE = "d4e5f6a7b8c9"
TARGET = "e7b2c4d9a1f0"
PASSWORD = "Migration-Test-Passw0rd!"


def alembic(url, *args):
    env = {**os.environ, "DATABASE_URL": url}
    env.pop("PGSSLMODE", None)
    return subprocess.run([sys.executable, "-m", "alembic", *args], cwd=BACKEND_DIR, env=env,
                          capture_output=True, text=True, timeout=180)


def run(coro):
    return asyncio.run(coro)


async def _with_engine(url, fn):
    s = database_settings(url)
    eng = create_async_engine(s.url, connect_args=s.connect_args)
    try:
        async with eng.begin() as conn:
            return await fn(conn)
    finally:
        await eng.dispose()


def email_indexes(url):
    """{index name: definition} for the users table, excluding the primary key."""
    async def q(conn):
        if conn.dialect.name == "postgresql":
            rows = await conn.execute(text(
                "select indexname, indexdef from pg_indexes where tablename = 'users' and indexname <> 'users_pkey'"))
        else:
            rows = await conn.execute(text(
                "select name, sql from sqlite_master where type = 'index' and tbl_name = 'users' and sql is not null"))
        return dict(rows.all())
    return run(_with_engine(url, q))


def insert_users(url, emails, hashed_password="not-a-real-hash"):
    async def q(conn):
        ids = {}
        for e in emails:
            uid = uuid.uuid4()
            await conn.execute(insert(User.__table__).values(
                id=uid, email=e, hashed_password=hashed_password,
                is_active=True, is_superuser=False, is_verified=False, role="guest"))
            ids[e] = uid
        return ids
    return run(_with_engine(url, q))


def all_users(url):
    async def q(conn):
        rows = await conn.execute(select(User.__table__.c.id, User.__table__.c.email,
                                         User.__table__.c.hashed_password).order_by(User.__table__.c.email))
        return [tuple(r) for r in rows]
    return run(_with_engine(url, q))


def current_revision(url):
    out = alembic(url, "current").stdout.split()
    return out[0] if out else None


class _MigrationCases:
    """Shared cases; subclasses provide database() yielding a fresh, empty DATABASE_URL."""

    def assertOk(self, proc):
        self.assertEqual(proc.returncode, 0, proc.stderr[-2000:])

    def test_fresh_upgrade_enforces_case_insensitive_uniqueness(self):
        with self.database() as url:
            self.assertOk(alembic(url, "upgrade", "head"))
            idx = email_indexes(url)
            self.assertEqual(list(idx), ["ix_users_email_lower"])
            self.assertIn("UNIQUE INDEX", idx["ix_users_email_lower"])
            self.assertIn("lower(", idx["ix_users_email_lower"])
            insert_users(url, ["Fresh.Install@example.com"])
            with self.assertRaises(IntegrityError):
                insert_users(url, ["fresh.install@EXAMPLE.COM"])

    def test_upgrade_of_existing_database_keeps_accounts_unchanged_and_downgrade_restores_index(self):
        with self.database() as url:
            self.assertOk(alembic(url, "upgrade", BEFORE))
            self.assertEqual(list(email_indexes(url)), ["ix_users_email"])
            hashed = PasswordHelper().hash(PASSWORD)
            insert_users(url, ["Existing.One@example.com", "existing.two@example.com"], hashed_password=hashed)
            before = all_users(url)

            self.assertOk(alembic(url, "upgrade", "head"))
            self.assertEqual(current_revision(url), TARGET)
            self.assertEqual(all_users(url), before)  # same ids, emails (case kept) and password hashes
            ok, _ = PasswordHelper().verify_and_update(PASSWORD, all_users(url)[0][2])
            self.assertTrue(ok)
            self.assertEqual(list(email_indexes(url)), ["ix_users_email_lower"])

            self.assertOk(alembic(url, "downgrade", BEFORE))
            self.assertEqual(list(email_indexes(url)), ["ix_users_email"])
            self.assertEqual(all_users(url), before)

    def test_upgrade_refuses_existing_case_duplicates_and_changes_nothing(self):
        with self.database() as url:
            self.assertOk(alembic(url, "upgrade", BEFORE))
            insert_users(url, ["Taken@example.com", "taken@example.com", "unrelated@example.com"])
            before = all_users(url)

            proc = alembic(url, "upgrade", "head")
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("Cannot enforce case-insensitive email uniqueness: 1 email address(es)", proc.stderr)
            self.assertIn("No data was changed", proc.stderr)
            self.assertNotIn("taken@example.com", proc.stderr.lower())  # no addresses in deploy logs
            self.assertEqual(current_revision(url), BEFORE)
            self.assertEqual(all_users(url), before)
            self.assertEqual(list(email_indexes(url)), ["ix_users_email"])

    def test_offline_sql_includes_the_duplicate_check(self):
        with self.database() as url:
            proc = alembic(url, "upgrade", f"{BEFORE}:{TARGET}", "--sql")
            self.assertOk(proc)
            self.assertIn("must return no rows", proc.stdout)
            self.assertIn("ix_users_email_lower", proc.stdout)


class SqliteMigrationTests(_MigrationCases, unittest.TestCase):

    @contextmanager
    def database(self):
        with tempfile.TemporaryDirectory() as d:
            yield f"sqlite+aiosqlite:///{d}/migration.db"


@unittest.skipUnless(_pg_temp.PG_URL, "set PAPER_TEST_POSTGRES_URL to a disposable non-SSL PostgreSQL")
class PostgresMigrationTests(_MigrationCases, unittest.TestCase):

    def database(self):
        return _pg_temp.temp_database()

    def test_alembic_check_reports_no_drift(self):
        # On PostgreSQL the models and migrations must match exactly. (SQLite
        # reports long-standing GUID/CHAR(32) type differences unrelated to #55.)
        with self.database() as url:
            self.assertOk(alembic(url, "upgrade", "head"))
            proc = alembic(url, "check")
            self.assertOk(proc)
            self.assertIn("No new upgrade operations detected", proc.stdout + proc.stderr)


if __name__ == "__main__":
    unittest.main()
