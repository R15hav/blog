#!/usr/bin/env bash
#
# Container entrypoint for the consolidated blog-app image.
#
#   1. Render nginx.conf.template -> /etc/nginx/nginx.conf (substituting $PORT)
#   2. Ensure uploads dir exists
#   3. Run alembic migrations (loud failure if they break)
#   4. exec supervisord -> backend + frontend + nginx
#
# Required env at runtime:
#   - DATABASE_URL  (postgres or sqlite URL)
#   - SECRET        (JWT signing secret -- MUST override the dev default)
# Optional:
#   - PORT             (default 8080, set by Dockerfile)
#   - FIRST_ADMIN_EMAIL
#   - FRONTEND_URL     (CORS allow-origin -- in single-image mode this is
#                       the public URL of the container itself)

set -euo pipefail

PORT="${PORT:-8080}"
export PORT

echo "[start.sh] Rendering nginx config (PORT=${PORT})..."
# Restrict envsubst to $PORT only so nginx-native variables ($host, etc.)
# are left intact in the final config.
envsubst '$PORT' < /deploy/nginx.conf.template > /etc/nginx/nginx.conf

# Validate the rendered config early -- supervisord would otherwise crash-
# loop nginx silently if the template was broken.
nginx -t -c /etc/nginx/nginx.conf

echo "[start.sh] Ensuring uploads directory exists..."
mkdir -p /app/backend/uploads
chmod 0755 /app/backend/uploads

if [ -n "${DATABASE_URL:-}" ]; then
    echo "[start.sh] Running alembic migrations..."
    # Loud failure: if migrations break, the container must NOT proceed --
    # serving an app against an out-of-date schema corrupts data.
    cd /app/backend
    uv run --no-sync alembic upgrade head
    cd /app
else
    echo "[start.sh] WARNING: DATABASE_URL not set -- skipping migrations." >&2
    echo "[start.sh] WARNING: backend will fall back to sqlite+aiosqlite:///./test.db" >&2
fi

echo "[start.sh] Handing off to supervisord..."
exec /usr/bin/supervisord -c /deploy/supervisord.conf
