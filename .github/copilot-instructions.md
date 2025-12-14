# Copilot instructions — blog project

Summary
- Small FastAPI-based blog service using async SQLAlchemy and `fastapi-users` for auth.
- Key files: `app/app.py`, `app/db.py`, `app/users.py`, `app/schemas.py`, `main.py`, `pyproject.toml`.

Architecture & intent
- `app/app.py`: FastAPI application and HTTP routes. Routers for `fastapi_users` are mounted here. Startup creates DB tables via `create_db_and_tables()`.
- `app/db.py`: Declarative models (`User`, `Post`) and async DB setup. Uses `sqlite+aiosqlite:///./test.db` by default. Exposes `get_async_session()` and `get_user_db()`.
- `app/users.py`: `fastapi-users` configuration and `UserManager`. JWT auth backend defined (`auth/jwt/login`). `current_active_user` dependency enforces authentication.
- `app/schemas.py`: Pydantic models used in requests/responses (notably `PostBase` and `User*` types).

Developer workflows (UV)
- Initialize and run with UV: this project uses UV for local workflows instead of direct `python`/`pip` commands.

- Start development server (auto-reloads):

  uv init

  uv run ./main.py

- Alternative (uvicorn) still supported:

  uvicorn app.app:app --reload --host 0.0.0.0 --port 8000

- DB: the project uses a local SQLite file (`./test.db`) created automatically on startup by `create_db_and_tables()`.
- Python requirement: see `pyproject.toml` (requires Python >= 3.12). Dependencies declared in `pyproject.toml` are managed by the UV environment rather than manual `pip` install.

Auth, tokens, and important config
- Authentication is implemented with `fastapi-users` and JWTs. Token endpoint path: `/auth/jwt/login`.
- `SECRET` is defined in `app/users.py` (currently hard-coded). To change token behavior, edit `get_jwt_strategy()` and `SECRET` there. Token lifetime is set to 3600 seconds.
- User IDs are UUIDs (see `User` model and Pydantic `UserRead` with `uuid.UUID`). Many endpoints expect UUID strings.

Patterns and notable code examples
- Async DB sessions: endpoints request `session: AsyncSession = Depends(get_async_session())`. Use `await session.execute(...)`, `await session.commit()` and `await session.refresh(obj)`.
- Post creation: `POST /create-blog` expects JSON matching `PostBase` (title, content, published, created_date). `created_date` is sent as a string and parsed with format `%Y-%m-%d %H:%M:%S` in `app/app.py`.
- Ownership checks: delete endpoint compares `article.owner_id` to `user.id` (from `current_active_user`) before deleting.
- Routers: authentication and user management endpoints are registered via `fastapi_users.get_*_router` calls in `app/app.py`.

Examples
- Create a blog (authenticated):

  POST /create-blog
  {
    "title": "Hello",
    "content": "World",
    "published": true,
    "created_date": "2025-12-14 12:34:00"
  }

- Get blogs (no auth): `GET /get-blogs`
- Delete blog (authenticated): `DELETE /delete-blog/{uuid}`

What to look for when editing
- Database URL is in `app/db.py` as `DATABASE_URL`. Changing DB engines or connection strings requires updating the URL and possibly dependencies.
- If you change models, be aware `create_db_and_tables()` is called at startup; migrations are not present.
- Auth flows (reset/verify) are enabled via mounted routers — their behavior follows `fastapi-users` defaults.

If you need more
- If anything is unclear or you want expanded guidance (test commands, CI, or env var usage), tell me which areas to expand or any conventions you want enforced.
