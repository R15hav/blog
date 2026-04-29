# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack blog app: FastAPI backend (`backend/`) + Next.js 16 frontend (`frontend/`). Backend runs on port 8000, frontend on port 3000.

## Commands

### Backend

```bash
# Run dev server (from repo root)
uv run ./backend/main.py
# or
uvicorn backend.app.app:app --reload --host 0.0.0.0 --port 8000
```

Managed by [uv](https://github.com/astral-sh/uv). Dependencies in [backend/pyproject.toml](backend/pyproject.toml). Python 3.12+.

### Frontend

```bash
cd frontend
npm run dev       # start dev server
npm run build     # production build
npm run lint      # eslint
```

## Architecture

### Backend (`backend/app/`)

The FastAPI app is structured in layers:

- **[app/app.py](backend/app/app.py)** — app entry point; mounts `fastapi-users` routers and `articles_router`; CORS configured for `localhost:3000`
- **[app/api/v1/articles.py](backend/app/api/v1/articles.py)** — route handlers; thin layer that calls services
- **[app/services/articles.py](backend/app/services/articles.py)** — business logic (CRUD, ownership checks, date parsing)
- **[app/database/db.py](backend/app/database/db.py)** — SQLAlchemy models (`User`, `Post`), async engine, `get_async_session` dependency; DB auto-created on startup via `create_db_and_tables()`
- **[app/models/](backend/app/models/)** — Pydantic request/response schemas (`ArticleBase`, `UserRead`, `UserCreate`, `UserUpdate`)
- **[app/core/users.py](backend/app/core/users.py)** — `fastapi-users` wiring: `UserManager`, JWT strategy, `current_active_user` dependency

Auth routes: `POST /auth/jwt/login`, `POST /auth/register`. Article routes under `/api/v1/`.

### Frontend (`frontend/app/`)

Next.js App Router with two route groups:

- **`(auth)/`** — login, register, forgot-password pages
- **`(blog)/`** — home feed, create-article, update-article/[articleId], search-article

Shared utilities:
- **[app/_lib/api_callout.js](frontend/app/_lib/api_callout.js)** — fetch wrappers for all backend API calls; hardcoded to `http://localhost:8000`
- **[app/_lib/utility.js](frontend/app/_lib/utility.js)** — `getTokenFromLocalStorage()` (decodes JWT, extracts `owner_id`) and `getCurrentFormattedDate()`
- **[app/components/Editorjs.js](frontend/app/components/Editorjs.js)** — Editor.js rich-text editor component (used in create/update article pages)

JWT token is stored in `localStorage` as `access_token`.

## Key Gotchas

- **`Post.published`** is stored as a `String` (`"true"`/`"false"`), not a boolean. Services call `str(post.published).lower()` before saving.
- **`ArticleBase.created_date`** expects the string format `"%Y-%m-%d %H:%M:%S"` — the service layer calls `datetime.strptime` with this exact format.
- **`Post.id` and `User.id`** use `UUID(as_uuid=True)` from `sqlalchemy.dialects.postgresql` even though the default DB is SQLite — be mindful when switching engines.
- **No migrations**: `create_db_and_tables()` runs `metadata.create_all` on startup. To reset, delete `backend/test.db`.
- **`SECRET`** for JWT is defined in `backend/app/core/users.py` — use env vars in production.
