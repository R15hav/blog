#!/bin/sh
set -e

# Render injects $PORT; fall back to 10000 for local Docker testing
export PORT=${PORT:-10000}

echo "==> Generating nginx config for PORT=$PORT"
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "==> Running database migrations"
echo "    DATABASE_URL scheme: $(echo ${DATABASE_URL:-sqlite} | cut -d: -f1)"
cd /app/backend
set +e
.venv/bin/alembic upgrade head 2>&1
MIGRATION_EXIT=$?
set -e
if [ $MIGRATION_EXIT -ne 0 ]; then
    echo "==> Migration failed with exit code $MIGRATION_EXIT — see output above"
    exit 1
fi

echo "==> Starting services (nginx + uvicorn + node)"
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/app.conf
