# blog

Small FastAPI-based blog service (async SQLAlchemy) with `fastapi-users` JWT auth.

This repository was created with UV and demonstrates:
- Async SQLAlchemy models and sessions
- Authentication and user management via `fastapi-users`
- Simple blog CRUD endpoints protected by JWT tokens

Quick start (UV)

1. Initialize the project environment with UV (if needed):

```bash
uv init
```

2. Run the development server with UV (auto-reloads):

```bash
uv run ./main.py
```

Alternative: run directly with uvicorn:

```bash
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

Configuration notes
- Python requirement: >= 3.12 (see `pyproject.toml`).
- Database: default is SQLite (`sqlite+aiosqlite:///./test.db`). The DB file is created automatically on startup by `create_db_and_tables()` in `app/database/db.py`.
- Secret key: `SECRET` is currently hard-coded in `app/core/users.py`. For production, move this to an environment variable and update `get_jwt_strategy()`.

Primary files
- `app/app.py` — FastAPI app, route definitions, and startup lifecycle (calls `create_db_and_tables()`).
- `app/database/db.py` — SQLAlchemy `DeclarativeBase`, `User` and `Post` models, async engine and session maker.
- `app/core/users.py` — `fastapi-users` setup, `UserManager`, JWT auth backend and `current_active_user` dependency.
- `app/models/*` — Pydantic schemas used by endpoints (`articles.py`, `users.py`).
- `main.py` — simple uvicorn launcher used for development.

Available endpoints (examples)
- `POST /auth/jwt/login` — obtain JWT token (via `fastapi-users`).
- `POST /auth/register` — register a new user.
- `GET /get-blogs` — list all posts (no auth required).
- `GET /get-blog/{id}` — retrieve a blog by UUID.
- `POST /create-blog` — create a blog (requires JWT auth; uses `current_active_user`).
- `DELETE /delete-blog/{id}` — delete a blog (requires JWT auth and owner check).

Example: create a blog (authenticated)

1. Login using `/auth/jwt/login` and obtain a bearer token.
2. Send a `POST /create-blog` with JSON matching `app/models/articles.ArticleBase`:

```json
{
	"title": "Hello",
	"content": "World",
	"published": true,
	"created_date": "2025-12-14 12:34:00"
}
```

Notes on patterns and gotchas
- `created_date` is parsed in `app/app.py` using `%Y-%m-%d %H:%M:%S` — send dates as strings matching that format.
- `User.id` and `Post.owner_id` are UUIDs. Endpoints that accept IDs expect UUID strings.
- `Post.published` is stored as a string (`"true"`/`"false"`) in the DB; Pydantic uses `bool` — conversions are handled in `app/app.py`.
- Sessions are async: endpoints depend on `get_async_session()` and use `await session.execute(...)`, `await session.commit()`, `await session.refresh(...)`.
- There are no DB migrations — `create_db_and_tables()` creates tables at startup. Consider adding Alembic for production.

Developer tips
- Move `SECRET` into environment variables (e.g., via `python-dotenv`) and update `app/core/users.py`.
- To reset the DB during development, remove `./test.db` and restart the server.

If you want
- I can (a) update `app/core/users.py` to read `SECRET` from environment, (b) add a small smoke-test script that registers a user and creates a post, or (c) add Alembic scaffolding and instructions. Tell me which.

This repository was created using UV and provides a minimal example of:
- Async SQLAlchemy models and sessions
- Authentication and user management via `fastapi-users`
- Simple blog CRUD endpoints protected by JWT tokens

Quick start (UV)

This project was created and is run using UV. No `pip install` steps are required for the basic development flow below.

1. Initialize the project environment with UV (if needed):

```bash
uv init
```

2. Run the development server with UV (auto-reloads):

```bash
uv run ./main.py
```

Notes: if you prefer to run `uvicorn` directly you can still use:

```bash
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

Configuration notes
- Python requirement: >= 3.12 (see `pyproject.toml`).
- Database: default is SQLite (`sqlite+aiosqlite:///./test.db`). The DB file is created automatically on startup by `create_db_and_tables()` in `app/db.py`.
- Secret key: `SECRET` is currently hard-coded in `app/users.py`. For production, move this to an environment variable and update `get_jwt_strategy()`.

Primary files
- `app/app.py` — FastAPI app, route definitions, and startup lifecycle (calls `create_db_and_tables()`).
- `app/db.py` — SQLAlchemy `DeclarativeBase`, `User` and `Post` models, async engine and session maker.
- `app/users.py` — `fastapi-users` setup, `UserManager`, JWT auth backend and `current_active_user` dependency.
- `app/schemas.py` — Pydantic schemas used by endpoints.
- `main.py` — simple uvicorn launcher used for development.

Running and testing endpoints

Available (example) endpoints:
- `POST /auth/jwt/login` — obtain JWT token (via `fastapi-users`).
- `POST /auth/register` — register a new user.
- `GET /get-blogs` — list all posts (no auth required).
- `GET /get-blog/{id}` — retrieve a blog by UUID.
- `POST /create-blog` — create a blog (requires JWT auth; uses `current_active_user`).
- `DELETE /delete-blog/{id}` — delete a blog (requires JWT auth and owner check).

Example: create a blog (authenticated)

1. Login using `/auth/jwt/login` and obtain a bearer token.
2. Send a `POST /create-blog` with JSON matching `app/schemas.PostBase`:

```json
{
	"title": "Hello",
	"content": "World",
	"published": true,
	"created_date": "2025-12-14 12:34:00"
}
```

Notes on patterns and gotchas
- `created_date` is parsed in `app/app.py` using the format `%Y-%m-%d %H:%M:%S` — send dates as strings matching that format.
- `User.id` and `Post.owner_id` are UUIDs. Endpoints that accept IDs expect UUID strings.
- Sessions are async: endpoints depend on `get_async_session()` and use `await session.execute(...)`, `await session.commit()` and `await session.refresh(...)`.
- There are no DB migrations — `create_db_and_tables()` creates tables at startup. Changing models will recreate tables only when called; consider adding migrations for production.

Development tips
- Move `SECRET` into environment variables (e.g., via `python-dotenv`) and update `app/users.py`.
- To reset the DB during development, remove `./test.db` and restart the server.

If you want
- I can (a) update `app/users.py` to read `SECRET` from environment, (b) add a small smoke-test script that registers a user and creates a blog, or (c) add instructions for containerization. Tell me which.

