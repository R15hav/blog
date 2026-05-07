# syntax=docker/dockerfile:1.6
#
# Single-image consolidation: FastAPI backend + Next.js frontend behind an
# internal nginx, exposing only nginx publicly on $PORT.
#
# Build: docker build -t blog-app:latest .
# Run:   docker run --rm -p 8080:8080 -e DATABASE_URL=... blog-app:latest

# -----------------------------------------------------------------------------
# Stage 1: frontend-builder
# -----------------------------------------------------------------------------
# We intentionally do NOT pass NEXT_PUBLIC_API_URL here. The browser bundle
# in frontend/app/_lib/api_callout.js falls back to "" when unset, producing
# relative URLs that nginx routes to the backend on the same origin.
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies first for better layer caching
COPY frontend/package*.json ./
RUN npm ci --include=dev

# Copy source and build the standalone output
COPY frontend/ ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# -----------------------------------------------------------------------------
# Stage 2: backend-builder
# -----------------------------------------------------------------------------
# uv installs the project venv at /app/backend/.venv by default. We sync with
# --frozen since the repo ships uv.lock; --no-dev keeps the runtime image lean.
FROM python:3.12-slim AS backend-builder

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy

# Install uv via pip (simple, deterministic, no extra network round-trips)
RUN pip install --no-cache-dir uv

WORKDIR /app/backend

# Resolve dependencies first for layer caching
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# Copy backend source
COPY backend/ ./

# Re-sync to install the project itself against the locked deps (idempotent)
RUN uv sync --frozen --no-dev


# -----------------------------------------------------------------------------
# Stage 3: runtime
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    PATH=/app/backend/.venv/bin:$PATH \
    DEBIAN_FRONTEND=noninteractive

# Install nginx + supervisor + curl (healthcheck) + Node 20 (NodeSource).
# Node is required to run the Next.js standalone server.js. We use NodeSource
# rather than copying alpine binaries because libc differs (musl vs glibc).
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        nginx \
        supervisor \
        gettext-base; \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; \
    apt-get install -y --no-install-recommends nodejs; \
    apt-get purge -y --auto-remove gnupg; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf || true

# Install uv in the runtime stage too -- start.sh uses `uv run alembic` for
# migrations. (Alternative: invoke alembic directly from the venv.)
RUN pip install --no-cache-dir uv

WORKDIR /app

# --- Backend: copy source + pre-built .venv from backend-builder ---
COPY --from=backend-builder /app/backend /app/backend

# --- Frontend: standalone server + static assets + public dir ---
# Next.js standalone output ships its own minimal node_modules under
# /app/frontend/server.js. We must also bring static/ and public/ alongside.
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend/
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public

# Deploy assets (nginx template, supervisord conf, entrypoint)
COPY deploy/ /deploy/
RUN chmod +x /deploy/start.sh

# Uploads dir must exist & be writable. In production this should be a
# mounted volume so logos survive container restarts.
RUN mkdir -p /app/backend/uploads && chmod 0755 /app/backend/uploads

EXPOSE 8080

# Healthcheck hits the nginx-served /healthz which does not depend on backend
# or frontend being ready -- it confirms the proxy itself is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/healthz" || exit 1

ENTRYPOINT ["/deploy/start.sh"]
