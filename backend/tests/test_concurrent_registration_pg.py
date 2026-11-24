"""Live PostgreSQL tests for #60: concurrent mixed-case registration.

Run from backend/ with a disposable PostgreSQL server WITHOUT SSL:
    PAPER_TEST_POSTGRES_URL=postgresql://user:pass@127.0.0.1:55432/db \\
        uv run python -m unittest discover -s tests -v

Skipped when PAPER_TEST_POSTGRES_URL is unset; CI provides it. Each test gets
its own temporary database (see _pg_temp.py), migrated with `alembic upgrade
head`, and drives the real /auth/register route in a subprocess so that
app.database.db binds to that database exactly as in production.
"""
import json
import os
import subprocess
import sys
import textwrap
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pg_temp  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUPLICATE = "REGISTER_USER_ALREADY_EXISTS"
VARIANTS = 6
_TEST_SECRET = "0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0"

# Runs inside the subprocess. Prints one JSON object on its last line.
_PROBE = textwrap.dedent("""
    import asyncio, json, os, sys
    from unittest import mock
    import httpx
    from sqlalchemy import func, select, text
    from app.app import app
    from app.services.bootstrap import bootstrap_first_admin
    from app.database.db import SiteConfig, User, async_session_maker
    from app.services.site_settings import update_site_config
    from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

    PASSWORD = "Concurrency-Test-Passw0rd!"
    ADMIN_PASSWORD = "Operator-Bootstrap-Passw0rd!"
    scenario, email = sys.argv[1], sys.argv[2]
    n = int(sys.argv[3])

    def variants(addr):
        local, domain = addr.split("@")
        forms = [addr, addr.lower(), addr.upper(), local.upper() + "@" + domain.lower(),
                 local.lower() + "@" + domain.upper(), addr.swapcase()]
        return (forms * n)[:n]

    async def accounts(addr):
        async with async_session_maker() as s:
            rows = await s.execute(select(User).where(func.lower(User.email) == addr.lower()))
            return [{"email": u.email, "is_active": u.is_active, "is_superuser": u.is_superuser}
                    for u in rows.scalars().all()]

    async def burst(client, addrs):
        rs = await asyncio.gather(*(client.post("/auth/register", json={"email": a, "password": PASSWORD})
                                    for a in addrs))
        return [{"status": r.status_code, "detail": (r.json().get("detail") if r.headers.get("content-type", "").startswith("application/json") else r.text[:200])} for r in rs]

    async def main():
        out = {}
        # raise_app_exceptions=False: an unhandled error becomes a visible 500 instead of a test crash.
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
                                   base_url="http://test")
        try:
            if scenario == "forced_race":
                # Every request's pre-insert lookup misses, and all INSERTs are
                # released together, so the database index alone decides.
                barrier = asyncio.Barrier(n)
                original_create = SQLAlchemyUserDatabase.create
                async def lookup_misses(self, _email):
                    return None
                async def synchronized_create(self, create_dict):
                    await asyncio.wait_for(barrier.wait(), timeout=30)
                    return await original_create(self, create_dict)
                with mock.patch.object(SQLAlchemyUserDatabase, "get_by_email", lookup_misses), \\
                     mock.patch.object(SQLAlchemyUserDatabase, "create", synchronized_create):
                    out["responses"] = await burst(client, variants(email))
            elif scenario == "settings_burst":
                rs = await asyncio.gather(*(client.get("/api/v1/settings") for _ in range(10)))
                out["statuses"] = [r.status_code for r in rs]
                async with async_session_maker() as s:
                    out["site_config_rows"] = (await s.execute(select(func.count()).select_from(SiteConfig))).scalar_one()
            elif scenario == "natural_burst":
                out["responses"] = await burst(client, variants(email))
            elif scenario == "bootstrap_race":
                # 4 server-side bootstraps race 4 public registrations of case
                # variants of the same address, with a different password.
                os.environ["FIRST_ADMIN_EMAIL"] = email
                os.environ["FIRST_ADMIN_PASSWORD"] = ADMIN_PASSWORD
                results = await asyncio.gather(
                    *(bootstrap_first_admin() for _ in range(4)),
                    burst(client, variants(email)[:4]),
                    return_exceptions=True)
                out["bootstrap"] = [r if isinstance(r, str) else repr(r) for r in results[:4]]
                out["register"] = results[4] if isinstance(results[4], list) else repr(results[4])
                async with async_session_maker() as s:
                    out["superusers"] = [u.email for u in (await s.execute(
                        select(User).where(User.is_superuser.is_(True)))).scalars().all()]
                    user = (await s.execute(select(User).where(func.lower(User.email) == email.lower()))).scalars().one_or_none()
                    from fastapi_users.password import PasswordHelper
                    out["password_is_env"] = bool(user and PasswordHelper().verify_and_update(
                        ADMIN_PASSWORD, user.hashed_password)[0])
                    out["password_is_public"] = bool(user and PasswordHelper().verify_and_update(
                        PASSWORD, user.hashed_password)[0])
            elif scenario == "inactive_login":
                out["register"] = await burst(client, [email])
                r = await client.post("/auth/jwt/login", data={"username": email, "password": PASSWORD})
                out["login_status"], out["login_detail"] = r.status_code, r.json().get("detail")
            out["accounts"] = await accounts(email)
        finally:
            await client.aclose()
        print(json.dumps(out))

    asyncio.run(main())
""")


@unittest.skipUnless(_pg_temp.PG_URL, "set PAPER_TEST_POSTGRES_URL to a disposable non-SSL PostgreSQL")
class ConcurrentRegistrationPostgresTests(unittest.TestCase):

    def _run(self, scenario, email):
        with _pg_temp.temp_database() as url:
            env = {**os.environ, "DATABASE_URL": url, "HCAPTCHA_ENABLED": "false"}
            env["SECRET"] = _TEST_SECRET  # same constant as tests/_isolated_db.py
            for k in ("PGSSLMODE", "FIRST_ADMIN_EMAIL", "FIRST_ADMIN_PASSWORD"):
                env.pop(k, None)
            mig = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND_DIR,
                                 env=env, capture_output=True, text=True, timeout=180)
            self.assertEqual(mig.returncode, 0, mig.stderr[-2000:])
            proc = subprocess.run([sys.executable, "-c", _PROBE, scenario, email, str(VARIANTS)],
                                  cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=300)
            self.assertEqual(proc.returncode, 0, proc.stderr[-3000:])
            self.assertNotIn("Traceback", proc.stderr, proc.stderr[-3000:])
            return json.loads(proc.stdout.strip().splitlines()[-1])

    def assertExactlyOneCreated(self, responses):
        statuses = sorted(r["status"] for r in responses)
        self.assertNotIn(500, statuses, responses)
        self.assertEqual(statuses.count(201), 1, responses)
        losers = [r for r in responses if r["status"] != 201]
        self.assertEqual(len(losers), len(responses) - 1)
        for r in losers:
            self.assertEqual((r["status"], r["detail"]), (400, DUPLICATE), responses)

    def test_simultaneous_inserts_of_case_variants_create_one_account(self):
        out = self._run("forced_race", "Race.Condition@Example.com")
        self.assertExactlyOneCreated(out["responses"])
        self.assertEqual(len(out["accounts"]), 1, out)
        self.assertFalse(out["accounts"][0]["is_active"])  # still inserted inactive

    def test_concurrent_burst_of_case_variants_creates_one_account(self):
        out = self._run("natural_burst", "Burst.Signup@Example.com")
        self.assertExactlyOneCreated(out["responses"])
        self.assertEqual(len(out["accounts"]), 1, out)

    def test_concurrent_first_settings_requests_create_one_row(self):
        out = self._run("settings_burst", "unused@example.com")
        self.assertEqual(out["statuses"], [200] * 10, out)
        self.assertEqual(out["site_config_rows"], 1, out)

    def test_bootstrap_race_never_yields_a_public_superuser_on_postgres(self):
        email = "Founder@Example.com"
        out = self._run("bootstrap_race", email)
        self.assertEqual(len(out["accounts"]), 1, out)          # exactly one account for the email
        self.assertLessEqual(len(out["superusers"]), 1, out)
        self.assertTrue(all(isinstance(b, str) for b in out["bootstrap"]), out)  # no exception
        self.assertIsInstance(out["register"], list, out)
        statuses = [r["status"] for r in out["register"]]
        self.assertNotIn(500, statuses, out)
        self.assertTrue(set(statuses) <= {201, 400}, out)
        self.assertLessEqual(statuses.count(201), 1, out)
        [account] = out["accounts"]
        if out["superusers"]:
            # The superuser is the env-created account, authenticated by the operator's password.
            self.assertEqual(len(out["superusers"]), 1, out)
            self.assertTrue(account["is_superuser"], out)
            self.assertTrue(out["password_is_env"], out)
            self.assertFalse(out["password_is_public"], out)
        else:
            # Every bootstrap lost to a public registration, which is never promoted.
            self.assertFalse(account["is_superuser"], out)
            self.assertEqual(statuses.count(201), 1, out)
            self.assertTrue(all(b in ("refused", "skipped") for b in out["bootstrap"]), out)

    def test_new_account_is_inactive_and_cannot_log_in(self):
        out = self._run("inactive_login", "Pending.Reader@Example.com")
        self.assertEqual([r["status"] for r in out["register"]], [201])
        self.assertEqual(out["login_status"], 400)
        self.assertEqual(out["login_detail"], "LOGIN_BAD_CREDENTIALS")
        self.assertFalse(out["accounts"][0]["is_active"])


if __name__ == "__main__":
    unittest.main()
