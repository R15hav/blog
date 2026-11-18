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

# IsolatedAsyncioTestCase runs the loop in debug mode, which logs a warning for
# every callback slower than 100 ms (password hashing is). That is noise here.
logging.getLogger("asyncio").setLevel(logging.ERROR)
