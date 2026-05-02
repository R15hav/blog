# =============================================================================
# Stage 1 — Build Next.js frontend
# =============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# NEXT_PUBLIC_API_URL is intentionally empty here.
# Client-side fetch calls become relative URLs (/api/v1/..., /auth/...)
# which nginx inside the container routes to FastAPI on port 8000.
# Server-side code (theme.ts, article page) falls back to http://localhost:8000
# and reaches FastAPI directly without going through nginx.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# =============================================================================
# Stage 2 — Build Python virtual environment
# =============================================================================
FROM python:3.12-slim AS backend-builder

WORKDIR /app/backend

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# =============================================================================
# Stage 3 — Final runtime image
# =============================================================================
FROM python:3.12-slim

# Install Node.js 20, nginx, supervisor, and gettext (for envsubst)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        nginx \
        supervisor \
        gettext-base \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Backend ───────────────────────────────────────────────────────────────────
WORKDIR /app/backend

COPY --from=backend-builder /app/backend/.venv .venv
COPY backend/ .

# ── Frontend ──────────────────────────────────────────────────────────────────
WORKDIR /app/frontend

COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static     ./.next/static
COPY --from=frontend-builder /app/public           ./public

# ── Config files ──────────────────────────────────────────────────────────────
COPY deploy/nginx.conf.template /etc/nginx/nginx.conf.template
COPY deploy/supervisord.conf    /etc/supervisor/conf.d/app.conf
COPY deploy/start.sh            /start.sh
RUN chmod +x /start.sh

# Remove the default nginx site so our config is the only one
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

EXPOSE 10000

CMD ["/start.sh"]
