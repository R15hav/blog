# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack blog app: FastAPI backend ([backend/](backend/)) + Next.js 16 frontend ([frontend/](frontend/)). Backend on port 8000, frontend on port 3000. Single-container production build via the root [Dockerfile](Dockerfile) (nginx + supervisord), or split via [docker-compose.yml](docker-compose.yml) with Postgres.

## Commands

### Backend

```bash
# Run dev server — MUST be run from backend/, not the repo root
cd backend
uv run python main.py
# or
uv run uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

`uv run` from the repo root fails with `ModuleNotFoundError: No module named 'uvicorn'` because [backend/pyproject.toml](backend/pyproject.toml) defines the `uv` project root. Python 3.12+ required.

### Database migrations (Alembic)

Alembic is configured ([backend/alembic.ini](backend/alembic.ini), [backend/alembic/env.py](backend/alembic/env.py)) and reads `DATABASE_URL` from env, normalising `postgres://` / `postgresql://` → `postgresql+asyncpg://`. Run from `backend/`:

```bash
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
uv run alembic downgrade -1
```

Note: [app.py](backend/app/app.py) also calls `create_db_and_tables()` (`metadata.create_all`) on startup as a safety net for fresh SQLite installs. For schema changes against an existing DB, write a migration — `create_all` will not alter existing tables.

### Frontend

```bash
cd frontend
npm run dev       # next dev (Turbopack)
npm run build     # production build (output: "standalone")
npm run lint      # eslint
```

Next.js 16 requires Node ≥ 20.9.0 (use [nvm](https://github.com/nvm-sh/nvm); the system Node on Debian/Ubuntu is often v18 and will refuse to start).

## Architecture

### Backend ([backend/app/](backend/app/))

Layered FastAPI app: `api/v1/*` (routes) → `services/*` (business logic) → `database/db.py` (SQLAlchemy models). Routes are thin handlers that call services; services own all transactions, ownership checks, and date parsing.

- **[app/app.py](backend/app/app.py)** — entry point. Mounts `fastapi-users` routers (`/auth/*`, `/users/*`), application routers under `/api/v1/`, and serves uploaded files at `/uploads/`. Lifespan handler runs `create_db_and_tables()` and promotes the user matching `FIRST_ADMIN_EMAIL` (env) to superuser/admin on each startup.
- **[app/api/v1/](backend/app/api/v1/)** — `articles.py` (CRUD + likes + comments), `admin.py` (users, themes, stats, site settings, logo upload — all gated by `current_superuser`), `author.py` (author dashboard), `profile.py` (user profile, experience, qualifications, school education).
- **[app/services/](backend/app/services/)** — `articles.py`, `admin.py`, `theme.py`, `site_settings.py`, `profile.py`. Service functions take an `AsyncSession` and return dicts or ORM instances.
- **[app/database/db.py](backend/app/database/db.py)** — all SQLAlchemy models (`User`, `Post`, `Like`, `Comment`, `UserProfile`, `Experience`, `Qualification`, `SchoolEducation`, `ThemeConfig`, `SiteConfig`), async engine, and `get_async_session` dependency. `_async_db_url()` rewrites Postgres URL schemes for asyncpg and strips `ssl=`/`sslmode=` query params (asyncpg mishandles them); SSL is passed via `connect_args` instead, with a 10s connect timeout to avoid silent 60s hangs.
- **[app/core/users.py](backend/app/core/users.py)** — `fastapi-users` wiring. Defines `current_active_user`, `current_optional_user`, and `current_author_or_admin` (custom dependency that 403s unless `is_superuser` or `role in ("author", "admin")`). `UserManager.on_after_register` sets `is_active=False` so new self-registrations require admin approval.

Auth: `POST /auth/jwt/login`, `POST /auth/jwt/logout`, `POST /auth/register`, plus `fastapi-users` reset-password and verify routers under `/auth`. JWT lifetime is 1 hour, secret from `SECRET` env var (default `dev-secret-change-me`). Note: `/auth/jwt/login`, `/auth/jwt/logout`, and `/auth/register` are all **custom routes** ([app/api/v1/login.py](backend/app/api/v1/login.py), [app/api/v1/register.py](backend/app/api/v1/register.py)) — the built-in fastapi-users `get_auth_router(...)` is not mounted. The login route runs `verify_hcaptcha` before credential authentication; the register route does the same before user creation. The reset-password and verify routers remain the unmodified fastapi-users built-ins.

### Frontend ([frontend/app/](frontend/app/))

Next.js App Router with three route groups:

- **[(auth)/](frontend/app/(auth)/)** — login, register, forgot-password
- **[(blog)/](frontend/app/(blog)/)** — public feed, article view, search, plus authenticated `create-article`, `update-article/[articleId]`, `dashboard`, `profile`. The blog layout dynamically injects the active theme stylesheet and generates metadata (OpenGraph/Twitter) from the backend's `/api/v1/settings`.
- **[(admin)/](frontend/app/(admin)/)** — admin panel (articles, comments, users, theme, site settings). Wrapped by [AdminGuard.js](frontend/app/(admin)/AdminGuard.js), which redirects to `/login` unless the user is a superuser, admin, or author. Admin-only nav items (`Users`, `Theme`) are hidden from non-superusers.

Shared:
- **[app/_lib/api_callout.js](frontend/app/_lib/api_callout.js)** — fetch wrappers for every backend endpoint. API base from `NEXT_PUBLIC_API_URL` env (defaults to empty string in this file but `http://localhost:8000` elsewhere — keep an eye on this when deploying).
- **[app/_lib/theme.ts](frontend/app/_lib/theme.ts)** — server-side fetchers for active theme URL and public site config; cached with `next: { revalidate: 60 }`.
- **[app/_lib/utility.js](frontend/app/_lib/utility.js)** — `getTokenFromLocalStorage()` decodes JWT payload to extract `owner_id`; `getCurrentFormattedDate()` produces the `"%Y-%m-%d %H:%M:%S"` string the backend expects.
- **[app/context/AuthContext.tsx](frontend/app/context/AuthContext.tsx)** — auth state. On mount, reads `access_token` from localStorage and verifies via `GET /users/me`; clears the token on failure.
- **[app/sitemap.js](frontend/app/sitemap.js) / [app/robots.js](frontend/app/robots.js)** — fetch site URL and published article list from the backend at build/request time.

### Themes & Site Settings

Admins can register external CSS URLs as `ThemeConfig` rows and activate one at a time. The active stylesheet is injected via `<link>` in [(blog)/layout.tsx](frontend/app/(blog)/layout.tsx). Site-wide config (name, description, logo, OG metadata, `allow_registration` flag) lives in a singleton `SiteConfig` row, exposed publicly at `/api/v1/settings` and editable via `/api/v1/admin/settings`. Logo uploads go to `backend/uploads/` (served at `/uploads/`).

## Configuration

| Variable              | Default                          | Where it's read                              |
|-----------------------|----------------------------------|----------------------------------------------|
| `DATABASE_URL`        | `sqlite+aiosqlite:///./test.db`  | [db.py](backend/app/database/db.py), [alembic/env.py](backend/alembic/env.py) |
| `SECRET`              | `dev-secret-change-me`           | [core/users.py](backend/app/core/users.py)   |
| `FRONTEND_URL`        | `http://localhost:3000`          | [app.py](backend/app/app.py) (CORS allow-origin) |
| `FIRST_ADMIN_EMAIL`   | (unset)                          | [app.py](backend/app/app.py) — auto-promotes that user to superuser/admin on every startup |
| `NEXT_PUBLIC_API_URL` | varies (`""` or `http://localhost:8000`) | frontend fetchers                    |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000`          | [robots.js](frontend/app/robots.js), [sitemap.js](frontend/app/sitemap.js) |
| `HCAPTCHA_ENABLED`    | `"false"`                        | [services/captcha.py](backend/app/services/captcha.py) — set `true`/`1`/`yes` (case-insensitive) to enable |
| `HCAPTCHA_SECRET`     | (unset)                          | [services/captcha.py](backend/app/services/captcha.py) — required when `HCAPTCHA_ENABLED=true` |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | (unset)              | [RegisterForm.js](frontend/app/(auth)/register/RegisterForm.js) — **build-time** (Next.js `NEXT_PUBLIC_*`); changing it requires a rebuild, not just a restart |

Backend reads `backend/.env` automatically via `python-dotenv`.

## Key Gotchas

- **Run backend from `backend/`, not the repo root** — `uv` won't find `pyproject.toml` otherwise.
- **`Post.published` is a `String`** (`"true"`/`"false"`), not a boolean. Services call `str(post.published).lower()` before saving and compare with `Post.published == "true"`. The frontend handles both `"true"` and `true` (see [sitemap.js:30](frontend/app/sitemap.js#L30)).
- **`ArticleBase.created_date`** is a string in `"%Y-%m-%d %H:%M:%S"` format. The service layer calls `datetime.strptime` with this exact format and 400s on mismatch. Use [getCurrentFormattedDate()](frontend/app/_lib/utility.js#L24) on the frontend.
- **`fastapi_users_db_sqlalchemy.generics.GUID`** is used for all UUID PKs/FKs (cross-dialect: stores as native UUID on Postgres, `CHAR(32)` on SQLite). Don't replace with `UUID(as_uuid=True)`.
- **New registrations are inactive by default** — `UserManager.on_after_register` flips `is_active=False`. An admin must activate via `PATCH /api/v1/admin/users/{id}/activate` before the user can log in.
- **`reactStrictMode: false`** in [next.config.ts](frontend/next.config.ts) is intentional — Editor.js double-init breaks under Strict Mode. Don't re-enable.
- **Postgres SSL**: asyncpg ignores `sslmode=` and mishandles `ssl=` query params. The URL normaliser strips them and SSL is passed via `connect_args` instead. If switching engines, replicate this.
- **Write access** uses three layers: `current_active_user` (logged-in), `current_author_or_admin` (role gate for create/update articles), `current_superuser` (admin-only routes). Ownership is then re-checked inside services (`if not user.is_superuser and obj.owner_id != user.id: 403`).
- **`SECRET`** for JWT defaults to `dev-secret-change-me` — must be overridden in production.
- **`NEXT_PUBLIC_HCAPTCHA_SITE_KEY`** is consumed at Next.js build time, not runtime — changing it requires a rebuild, not just a restart. On Render this means a fresh deploy.
- **When `HCAPTCHA_ENABLED=true` but `HCAPTCHA_SECRET` is missing**, registration and login return 500 (misconfigured) — fail-loud rather than silently letting users through.
- **Local-dev env split**: `HCAPTCHA_ENABLED` and `HCAPTCHA_SECRET` go in `backend/.env`; `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` goes in `frontend/.env.local` (copy from `frontend/.env.example`). A root-level `.env` is read by `docker compose` only — `uv run` looks at `backend/.env` and `next dev` looks at `frontend/.env.local`. After editing the frontend file, restart `next dev`.

## Deployment Notes

The production artifact is the **single-container** root [Dockerfile](Dockerfile): one image runs FastAPI (`127.0.0.1:8000`), Next.js standalone (`127.0.0.1:3000`), and nginx (`$PORT`, default 8080) under supervisord. **Only the nginx port is exposed publicly**; backend and frontend are loopback-only.

- [Dockerfile](Dockerfile) — three-stage build: `frontend-builder` (node:20-alpine, no `NEXT_PUBLIC_API_URL` baked), `backend-builder` (python:3.12-slim + uv, `uv sync --frozen --no-dev`), `runtime` (python:3.12-slim + nginx + supervisor + Node 20). HEALTHCHECK curls `/healthz`.
- [deploy/nginx.conf.template](deploy/nginx.conf.template) — rendered by `envsubst '$PORT'` at startup. Routes `/api/v1/`, `/auth/`, `/users/`, `/uploads/`, `= /docs`, `= /openapi.json` → backend; everything else → frontend (Next.js); `/healthz` returns 200 inline.
- [deploy/supervisord.conf](deploy/supervisord.conf) — supervises `backend` (uvicorn), `frontend` (`node /app/frontend/server.js`), and `nginx` (`daemon off;`).
- [deploy/start.sh](deploy/start.sh) — renders nginx config, runs `alembic upgrade head` if `DATABASE_URL` is set, then `exec supervisord`.
- [render.yaml](render.yaml) — one `blog-app` web service (`env: docker`, `dockerfilePath: ./Dockerfile`) + one managed `blog-db` Postgres + a `uploads` Render Disk mounted at `/app/backend/uploads`. `healthCheckPath: /healthz`.
- [docker-compose.yml](docker-compose.yml) — two services: `db` (Postgres, no published port) + `app` (builds root Dockerfile, only `8080:8080` published, named `uploads` volume).
- [render-deploy.md](render-deploy.md) — operator guide for the consolidated deploy.

### Single-image gotchas

- **Browser uses relative URLs**: `frontend/app/_lib/api_callout.js` defaults `NEXT_PUBLIC_API_URL` to `""`. The root Dockerfile **does not** pass `NEXT_PUBLIC_API_URL` as a build arg, so the client bundle hits `/api/v1/...` same-origin and nginx proxies internally. **Don't** set `NEXT_PUBLIC_API_URL` in `render.yaml` or `docker-compose.yml`.
- **Server-side fetches** in `frontend/app/_lib/theme.ts` and `(blog)/layout.tsx` default to `http://localhost:8000`, which is correct loopback for the consolidated container.
- **Uploads persistence**: backend writes to `/app/backend/uploads`. On Render this is a 1 GB disk; in compose it's the `uploads` named volume. Loss-on-redeploy is fixed.
- **Single-stage `backend/Dockerfile` and two-stage `frontend/Dockerfile` still exist** for split-mode dev experimentation, but they are **not used** by the production deploy — the root Dockerfile is.
- **`FRONTEND_URL`** is now same-origin in production (the public service URL). CORS still applies to it; set it via `sync: false` on Render after the first deploy.
