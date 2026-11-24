#!/bin/sh
# Shared container health check (Dockerfile HEALTHCHECK and docker-compose).
#
#   1. nginx /healthz -> backend /api/v1/health -> SELECT 1 on the database
#   2. Next.js serving a tiny static file directly on loopback. This only
#      proves the Node server is up and serving; it does not render a page.
#
# Silent on success; exits non-zero (curl's message on stderr) on failure.

curl -fsS -o /dev/null --max-time 4 "http://127.0.0.1:${PORT:-8080}/healthz" || exit 1
curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:3000/healthz.txt || exit 1
