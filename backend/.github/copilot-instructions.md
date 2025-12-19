```markdown
# Copilot instructions — blog project

Summary
- Small FastAPI-based blog service using async SQLAlchemy and `fastapi-users` for auth.
- Key files: app/app.py, app/database/db.py, app/core/users.py, app/models, main.py, pyproject.toml.

**Architecture & intent**
- `app/app.py`: FastAPI app, route handlers, and mounted `fastapi-users` routers. Uses an async lifespan to call `create_db_and_tables()` at startup.
- `app/database/db.py`: SQLAlchemy Declarative `Base`, `User` and `Post` models, async engine and `async_sessionmaker`. Default DB: `sqlite+aiosqlite:///./test.db` (auto-created on startup).
- `app/core/users.py`: `fastapi-users` setup (UserManager, JWT strategy, `auth_backend`, `fastapi_users`) and `current_active_user` dependency.
- `app/models/*`: Pydantic types used by endpoints (e.g., `ArticleBase` in `app/models/articles.py` and `UserRead`/`UserCreate` in `app/models/users.py`).

Developer workflows
- Primary dev runner: the project is designed for UV. Typical flow:

  - `uv init` (one-time)
  - `uv run ./main.py` (development server with reload)

- `uvicorn app.app:app --reload --host 0.0.0.0 --port 8000` also works (used by `main.py`).
- DB file: `./test.db` is created automatically at startup by `create_db_and_tables()` in `app/database/db.py`.
- Python: see `pyproject.toml` (requires Python >= 3.12).

Auth, tokens, and important config
- Auth uses `fastapi-users` + JWT. Token endpoint: `/auth/jwt/login` (mounted in `app/app.py`).
- `SECRET` currently lives in `app/core/users.py` (variable `SECRET`) and is used by `get_jwt_strategy()`; move to env for production.
- Tokens: lifetime 3600s by default. User IDs are UUIDs in DB and Pydantic schemas.

Project-specific patterns & gotchas
- Async sessions: use `get_async_session()` from `app/database/db.py` and operate with `await` (`session.execute`, `commit`, `refresh`). Example: `get_blogs()` in `app/app.py`.
- UUIDs: DB `Post.id` and `User.id` use `UUID(as_uuid=True)`; endpoints accept UUID strings and convert via `uuid.UUID(...)` (see `get_blog` and `delete_blog`).
- `ArticleBase.created_date` is a string that must match `%Y-%m-%d %H:%M:%S`; `app/app.py` parses it into a `datetime` before storing.
- `Post.published` is stored as a `String` in the DB (values like "true"/"false") even though Pydantic uses a `bool` — watch conversions when modifying models.
- No migrations: `create_db_and_tables()` creates tables at startup — changing models won't run migrations. For production, add Alembic or similar.
- `fastapi-users` routers are mounted explicitly in `app/app.py` with prefixes `/auth` and `/users`.

Examples (typical flows)
- Register: `POST /auth/register` (see mounted `fastapi-users` router in `app/app.py`).
- Login: `POST /auth/jwt/login` → receive `access_token` (Bearer).
- Create blog (authenticated):

  POST /create-blog
  {
    "title": "Hello",
    "content": "World",
    "published": true,
    "created_date": "2025-12-14 12:34:00"
  }

  - Include header `Authorization: Bearer <token>`; `create_blog` uses `current_active_user` to set `owner_id`.
- Get blogs (no auth): `GET /get-blogs`.
- Delete blog (authenticated owner only): `DELETE /delete-blog/{uuid}`.

# Copilot instructions — blog project

Summary
- Small FastAPI-based blog service using async SQLAlchemy and `fastapi-users` for auth.
- Key files: app/app.py, app/database/db.py, app/core/users.py, app/models, main.py, pyproject.toml.

**Architecture & intent**
- `app/app.py`: FastAPI app, route handlers, and mounted `fastapi-users` routers. Uses an async lifespan to call `create_db_and_tables()` at startup.
- `app/database/db.py`: SQLAlchemy Declarative `Base`, `User` and `Post` models, async engine and `async_sessionmaker`. Default DB: `sqlite+aiosqlite:///./test.db` (auto-created on startup).
- `app/core/users.py`: `fastapi-users` setup (UserManager, JWT strategy, `auth_backend`, `fastapi_users`) and `current_active_user` dependency.
- `app/models/*`: Pydantic types used by endpoints (e.g., `ArticleBase` in `app/models/articles.py` and `UserRead`/`UserCreate` in `app/models/users.py`).

Developer workflows
- Primary dev runner: the project is designed for UV. Typical flow:

  - `uv init` (one-time)
  - `uv run ./main.py` (development server with reload)

- `uvicorn app.app:app --reload --host 0.0.0.0 --port 8000` also works (used by `main.py`).
- DB file: `./test.db` is created automatically at startup by `create_db_and_tables()` in `app/database/db.py`.
- Python: see `pyproject.toml` (requires Python >= 3.12).

Auth, tokens, and important config
- Auth uses `fastapi-users` + JWT. Token endpoint: `/auth/jwt/login` (mounted in `app/app.py`).
- `SECRET` currently lives in `app/core/users.py` (variable `SECRET`) and is used by `get_jwt_strategy()`; move to env for production.
- Tokens: lifetime 3600s by default. User IDs are UUIDs in DB and Pydantic schemas.

Project-specific patterns & gotchas
- Async sessions: use `get_async_session()` from `app/database/db.py` and operate with `await` (`session.execute`, `commit`, `refresh`). Example: `get_blogs()` in `app/app.py`.
- UUIDs: DB `Post.id` and `User.id` use `UUID(as_uuid=True)`; endpoints accept UUID strings and convert via `uuid.UUID(...)` (see `get_blog` and `delete_blog`).
- `ArticleBase.created_date` is a string that must match `%Y-%m-%d %H:%M:%S`; `app/app.py` parses it into a `datetime` before storing.
- `Post.published` is stored as a `String` in the DB (values like "true"/"false") even though Pydantic uses a `bool` — watch conversions when modifying models.
- No migrations: `create_db_and_tables()` creates tables at startup — changing models won't run migrations. For production, add Alembic or similar.
- `fastapi-users` routers are mounted explicitly in `app/app.py` with prefixes `/auth` and `/users`.

Examples (typical flows)
- Register: `POST /auth/register` (see mounted `fastapi-users` router in `app/app.py`).
- Login: `POST /auth/jwt/login` → receive `access_token` (Bearer).
- Create blog (authenticated):

  POST /create-blog
  {
    "title": "Hello",
    "content": "World",
    "published": true,
    "created_date": "2025-12-14 12:34:00"
  }

  - Include header `Authorization: Bearer <token>`; `create_blog` uses `current_active_user` to set `owner_id`.
- Get blogs (no auth): `GET /get-blogs`.
- Delete blog (authenticated owner only): `DELETE /delete-blog/{uuid}`.

# Copilot instructions — blog project

Summary
- Small FastAPI-based blog service using async SQLAlchemy and `fastapi-users` for auth.
- Key files: `app/app.py`, `app/database/db.py`, `app/core/users.py`, `app/models`, `main.py`, `pyproject.toml`.

**Architecture & intent**
- `app/app.py`: FastAPI app, route handlers, and mounted `fastapi-users` routers. Uses an async lifespan to call `create_db_and_tables()` at startup.
- `app/database/db.py`: SQLAlchemy Declarative `Base`, `User` and `Post` models, async engine and `async_sessionmaker`. Default DB: `sqlite+aiosqlite:///./test.db` (auto-created on startup).
- `app/core/users.py`: `fastapi-users` setup (UserManager, JWT strategy, `auth_backend`, `fastapi_users`) and `current_active_user` dependency.
- `app/models/*`: Pydantic types used by endpoints (e.g., `ArticleBase` in `app/models/articles.py` and `UserRead`/`UserCreate` in `app/models/users.py`).

Developer workflows
- Primary dev runner: the project is designed for UV. Typical flow:

  - `uv init` (one-time)
  - `uv run ./main.py` (development server with reload)

- `uvicorn app.app:app --reload --host 0.0.0.0 --port 8000` also works (used by `main.py`).
- DB file: `./test.db` is created automatically at startup by `create_db_and_tables()` in `app/database/db.py`.
- Python: see `pyproject.toml` (requires Python >= 3.12).

Auth, tokens, and important config
- Auth uses `fastapi-users` + JWT. Token endpoint: `/auth/jwt/login` (mounted in `app/app.py`).
- `SECRET` currently lives in `app/core/users.py` (variable `SECRET`) and is used by `get_jwt_strategy()`; move to env for production.
- Tokens: lifetime 3600s by default. User IDs are UUIDs in DB and Pydantic schemas.

Project-specific patterns & gotchas
- Async sessions: use `get_async_session()` from `app/database/db.py` and operate with `await` (`session.execute`, `commit`, `refresh`). Example: `get_blogs()` in `app/app.py`.
- UUIDs: DB `Post.id` and `User.id` use `UUID(as_uuid=True)`; endpoints accept UUID strings and convert via `uuid.UUID(...)` (see `get_blog` and `delete_blog`).
- `ArticleBase.created_date` is a string that must match `%Y-%m-%d %H:%M:%S`; `app/app.py` parses it into a `datetime` before storing.
- `Post.published` is stored as a `String` in the DB (values like "true"/"false") even though Pydantic uses a `bool` — watch conversions when modifying models.
- No migrations: `create_db_and_tables()` creates tables at startup — changing models won't run migrations. For production, add Alembic or similar.
- `fastapi-users` routers are mounted explicitly in `app/app.py` with prefixes `/auth` and `/users`.

Examples (typical flows)
- Register: `POST /auth/register` (see mounted `fastapi-users` router in `app/app.py`).
- Login: `POST /auth/jwt/login` → receive `access_token` (Bearer).
- Create blog (authenticated):

  POST /create-blog
  {
    "title": "Hello",
    "content": "World",
    "published": true,
    "created_date": "2025-12-14 12:34:00"
  }

  - Include header `Authorization: Bearer <token>`; `create_blog` uses `current_active_user` to set `owner_id`.
- Get blogs (no auth): `GET /get-blogs`.
- Delete blog (authenticated owner only): `DELETE /delete-blog/{uuid}`.

What to look for when editing
- `DATABASE_URL` is in `app/database/db.py`. Switching DB engines may require dialect/package changes (the models use `UUID` from `sqlalchemy.dialects.postgresql` even though default is SQLite).
- `create_db_and_tables()` runs on startup; there are no migrations. Be intentional when changing models.
- `SECRET` & token settings are in `app/core/users.py` — prefer environment variables for secrets.
- `Post.published` stored as `String` — updates to this column should consider existing string values.

If you want me to iterate
- I can: (a) switch `SECRET` to env-vars and update `.env` loading, (b) add a tiny smoke-test that registers/logs in a user and creates a post, or (c) add Alembic scaffolding for migrations. Tell me which to do next.
