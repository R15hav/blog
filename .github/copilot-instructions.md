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
  # Copilot instructions — blog project

  Summary
  - Small FastAPI-based blog service using async SQLAlchemy and `fastapi-users` for auth.
  - Repository layout: top-level `backend/` (Python API) and `frontend/` (Next.js app).

  Key backend items
  - `backend/main.py`: app launcher for development.
  - `backend/pyproject.toml`: Python project metadata and dependencies.
  - `backend/app/`: application package containing the FastAPI app and modules.
  - `backend/app/app.py`: FastAPI app object, route handlers, and mounted `fastapi-users` routers.
  - `backend/app/database/db.py`: SQLAlchemy `Base`, models (`User`, `Post`), async engine and `async_sessionmaker`.
  - `backend/app/core/users.py`: `fastapi-users` setup (UserManager, JWT strategy, `auth_backend`, `fastapi_users`) and `current_active_user` dependency. `SECRET` is defined here currently — prefer environment variables.

  Architecture & intent
  - `backend/app/app.py` mounts `fastapi-users` routers and uses an async lifespan that calls `create_db_and_tables()` on startup.
  - `backend/app/database/db.py` defines models and uses `sqlite+aiosqlite:///./test.db` by default (DB file created at startup).
  - Pydantic schemas live in `backend/app/models/` (users, articles).

  Developer workflows
  - Dev runner: `uv run ./backend/main.py` or `uvicorn backend.app.app:app --reload --host 0.0.0.0 --port 8000`.
  - DB file: `./test.db` in `backend/` is created by `create_db_and_tables()` at startup.

  Auth, tokens, and important config
  - Auth uses `fastapi-users` + JWT; token endpoint is mounted at `/auth/jwt/login`.
  - `SECRET` currently in `backend/app/core/users.py`; move to environment variables for production.

  Project-specific patterns & gotchas
  - Use `get_async_session()` from `backend/app/database/db.py` and remember to `await` session operations.
  - UUIDs: `Post.id` and `User.id` use `UUID(as_uuid=True)` — endpoints accept UUID strings and convert via `uuid.UUID(...)`.
  - `ArticleBase.created_date` expects format `%Y-%m-%d %H:%M:%S`; `backend/app/app.py` converts it to `datetime` before storing.
  - `Post.published` is stored as a `String` in the DB (values like "true"/"false"); Pydantic may use `bool` — handle conversions carefully when changing models.
  - No migrations by default: `create_db_and_tables()` creates tables at startup. For production, add Alembic.

  Examples (typical flows)
  - Register: `POST /auth/register` (see mounted `fastapi-users` router in `backend/app/app.py`).
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
  - `DATABASE_URL` is referenced in `backend/app/database/db.py`. Models import `UUID` from `sqlalchemy.dialects.postgresql` while the default DB is SQLite — be mindful when switching DB engines.
  - `SECRET` and token settings live in `backend/app/core/users.py` — prefer environment variables for secrets.
  - `Post.published` stored as `String` — updates to this column should consider existing string values.

  If you want me to iterate
  - I can: (a) move `SECRET` to env vars and add `.env` loading in `backend/`, (b) add a small smoke-test that registers/logs in a user and creates a post, or (c) scaffold Alembic for migrations. Tell me which to do next.
Auth, tokens, and important config
