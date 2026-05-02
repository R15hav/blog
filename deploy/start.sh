#!/bin/sh
set -e

# Render injects $PORT; fall back to 10000 for local Docker testing
export PORT=${PORT:-10000}

echo "==> Generating nginx config for PORT=$PORT"
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "==> Running database migrations"
cd /app/backend
.venv/bin/alembic upgrade head

echo "==> Starting services (nginx + uvicorn + node)"
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/app.conf
