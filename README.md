
# Blog Project

Small full-stack blog example: a FastAPI backend and a Next.js frontend.

Repository layout
- `backend/` — Python FastAPI app (async SQLAlchemy, `fastapi-users` for auth).
- `frontend/` — Next.js application (React).

Quickstart (development)

Backend

1. Create a Python environment and install dependencies from `backend/pyproject.toml`.
2. Run the backend (development):

```bash
# from repo root
uv run ./backend/main.py
# or
uvicorn backend.app.app:app --reload --host 0.0.0.0 --port 8000
```

The backend will create a local SQLite DB `test.db` under `backend/` on first startup.

Frontend

1. From `frontend/`, install dependencies (`npm install` / `pnpm install` / `yarn`).
2. Start the dev server:

```bash
cd frontend
npm run dev
```

Auth & configuration
- Auth is provided by `fastapi-users` (JWT). The `SECRET` used for JWT lives in `backend/app/core/users.py` — move it to environment variables for production.
- Database URL is configured in `backend/app/database/db.py` (default: `sqlite+aiosqlite:///./test.db`).

Development tips
- Move `SECRET` into environment variables (e.g., via `python-dotenv`) and update `app/users.py`.
- To reset the DB during development, remove `./test.db` and restart the server.
