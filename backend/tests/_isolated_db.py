"""Shared test setup: point the app at a throwaway SQLite database.

Import this module before any `app` module: app.database.db builds its engine
from DATABASE_URL at import time. All test modules in one run share this
database; tests use unique fictional emails and assert only on their own rows.
"""
import atexit
import logging
import os
import tempfile

_TMP = tempfile.TemporaryDirectory()
atexit.register(_TMP.cleanup)

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP.name}/test.db"
os.environ["HCAPTCHA_ENABLED"] = "false"
os.environ.pop("FIRST_ADMIN_EMAIL", None)
os.environ.pop("FIRST_ADMIN_PASSWORD", None)

# Fixed test-only JWT secret (64 hex chars), set before any app import and
# overriding any inherited value: app.core.users refuses to import without one.
TEST_SECRET = "0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0"
os.environ["SECRET"] = TEST_SECRET

# IsolatedAsyncioTestCase runs the loop in debug mode, which logs a warning for
# every callback slower than 100 ms (password hashing is). That is noise here.
logging.getLogger("asyncio").setLevel(logging.ERROR)
