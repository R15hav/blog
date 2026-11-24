"""Validation of the JWT signing secret (the SECRET environment variable).

The same secret signs login, reset-password and verification tokens, so a
guessable value lets anyone forge an administrator token. The backend refuses
to start without a strong one: there is no development fallback.

Run `python -m app.core.secret` (from backend/) to validate the environment
without importing the app; deploy/start.sh does this before migrations.
"""
from __future__ import annotations

import os
import sys

MIN_SECRET_LENGTH = 32
MIN_DISTINCT_CHARS = 8

KNOWN_INSECURE_SECRETS = frozenset(
    {
        "dev-secret-change-me",
        "change-me-use-a-long-random-string-in-production",
        "changeme",
        "change-me",
        "secret",
    }
)

_FIX = (
    "Generate one with `openssl rand -hex 32` "
    '(or `python -c "import secrets; print(secrets.token_hex(32))"`) and set it as SECRET.'
)


class InsecureSecretError(RuntimeError):
    """SECRET is missing or too weak to sign tokens safely."""


def _fail(reason: str) -> InsecureSecretError:
    return InsecureSecretError(f"SECRET {reason}. {_FIX}")


def validate_secret(value: str | None) -> str:
    """Return value unchanged if it is a strong secret, else raise InsecureSecretError.

    Messages never contain the value itself.
    """
    if value is None or not value.strip():
        raise _fail("is not set")
    if value.strip().lower() in KNOWN_INSECURE_SECRETS:
        raise _fail("is a well-known placeholder value")
    if len(value) < MIN_SECRET_LENGTH:
        raise _fail(f"is too short (minimum {MIN_SECRET_LENGTH} characters)")
    if len(set(value)) < MIN_DISTINCT_CHARS:
        raise _fail(f"is too repetitive (needs at least {MIN_DISTINCT_CHARS} distinct characters)")
    return value


def load_secret() -> str:
    return validate_secret(os.getenv("SECRET"))


if __name__ == "__main__":
    try:
        load_secret()
    except InsecureSecretError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
    print("SECRET OK")
