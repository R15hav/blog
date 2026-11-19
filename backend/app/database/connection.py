"""Database URL normalisation and PostgreSQL SSL options.

Shared by the application engine (app/database/db.py) and Alembic
(alembic/env.py) so both always connect with the same settings.

The PostgreSQL driver is asyncpg. It does not accept libpq's ``sslmode`` (or
``ssl``) as URL query parameters through SQLAlchemy, so they are removed from
the URL and translated into asyncpg's ``ssl`` connect argument here.
Every other query parameter is preserved unchanged.

``sslmode`` values:

* ``disable``                 no SSL (e.g. the local Docker Compose database).
* ``allow`` / ``prefer``      asyncpg's own semantics: ``prefer`` tries SSL first
                              and falls back to plain text if the server refuses.
* ``require``                 SSL is mandatory; the certificate is not verified.
* ``verify-ca`` / ``verify-full``  SSL with certificate verification, handled by
                              asyncpg (root certificate from ``PGSSLROOTCERT`` or
                              ``~/.postgresql/root.crt``; fails if missing).
* absent                      same as ``require``. This keeps the previous
                              behaviour (SSL always required, unverified), which
                              hosted providers such as Render rely on. Plain-text
                              databases must opt out explicitly with
                              ``sslmode=disable``.

A legacy ``ssl=`` parameter is accepted as an alias (``true``/``false`` or a
mode name). Conflicting ``ssl`` and ``sslmode`` values, or unknown values, raise
``ValueError`` rather than guessing, so a configured SSL requirement is never
silently downgraded.
"""
from __future__ import annotations

import ssl
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# URL schemes treated as PostgreSQL; all are rewritten to the asyncpg driver.
_POSTGRES_SCHEMES = ("postgres", "postgresql", "postgresql+asyncpg")
_ASYNC_SCHEME = "postgresql+asyncpg"

SSL_MODES = ("disable", "allow", "prefer", "require", "verify-ca", "verify-full")
DEFAULT_SSLMODE = "require"
CONNECT_TIMEOUT_SECONDS = 10

_SSL_ALIASES = {"true": "require", "1": "require", "false": "disable", "0": "disable"}


@dataclass(frozen=True)
class DatabaseSettings:
    """Resolved connection settings: the SQLAlchemy URL plus driver connect_args."""

    url: str
    connect_args: dict = field(default_factory=dict)
    sslmode: str | None = None  # effective mode for PostgreSQL; None otherwise


def _is_postgres(scheme: str) -> bool:
    return scheme.lower() in _POSTGRES_SCHEMES


def _resolve_sslmode(sslmode: str | None, ssl_param: str | None) -> str:
    def norm(value: str, source: str) -> str:
        v = value.strip().lower()
        v = _SSL_ALIASES.get(v, v) if source == "ssl" else v
        if v not in SSL_MODES:
            raise ValueError(
                f"Unsupported {source}={value!r} in DATABASE_URL; expected one of: {', '.join(SSL_MODES)}"
            )
        return v

    mode = norm(sslmode, "sslmode") if sslmode is not None else None
    alias = norm(ssl_param, "ssl") if ssl_param is not None else None
    if mode and alias and mode != alias:
        raise ValueError(f"DATABASE_URL has conflicting sslmode={sslmode!r} and ssl={ssl_param!r}")
    return mode or alias or DEFAULT_SSLMODE


def _ssl_connect_arg(mode: str):
    """Translate a libpq-style sslmode into asyncpg's ``ssl`` argument.

    An explicit value is always returned: if ``ssl`` were left unset, asyncpg
    would fall back to the PGSSLMODE environment variable and then ``prefer``.
    """
    if mode == "disable":
        return False
    if mode == "require":
        # Mandatory, unverified TLS: identical to the context used before this
        # module existed, and independent of any ~/.postgresql/root.crt.
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    # allow / prefer / verify-ca / verify-full: asyncpg implements these modes.
    return mode


def database_settings(raw_url: str) -> DatabaseSettings:
    """Return the SQLAlchemy URL and connect_args for ``raw_url``.

    Non-PostgreSQL URLs (e.g. SQLite) are returned unchanged with no connect_args.
    """
    parts = urlsplit(raw_url)
    if not _is_postgres(parts.scheme):
        return DatabaseSettings(url=raw_url)

    query = parse_qsl(parts.query, keep_blank_values=True)
    sslmodes = [v for k, v in query if k == "sslmode"]
    ssl_params = [v for k, v in query if k == "ssl"]
    if len(sslmodes) > 1 or len(ssl_params) > 1:
        raise ValueError("DATABASE_URL must not repeat sslmode or ssl")
    mode = _resolve_sslmode(sslmodes[0] if sslmodes else None, ssl_params[0] if ssl_params else None)

    kept = [(k, v) for k, v in query if k not in ("sslmode", "ssl")]
    url = urlunsplit(parts._replace(scheme=_ASYNC_SCHEME, query=urlencode(kept)))
    return DatabaseSettings(
        url=url,
        connect_args={"ssl": _ssl_connect_arg(mode), "timeout": CONNECT_TIMEOUT_SECONDS},
        sslmode=mode,
    )
