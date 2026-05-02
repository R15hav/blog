# Blog Project — Local Development Guide

Full-stack blog app: **FastAPI** backend + **Next.js 16** frontend.

> Running with Docker or deploying to the cloud? See the **[Docker & Cloud Deployment Guide](docker-development.md)**.
> Deploying to Render as a single container? See the **[Render Deployment Guide](render-deploy.md)**.

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000      |
| Backend  | http://localhost:8000      |
| API docs | http://localhost:8000/docs |

---

## Features

- **Articles** — create, edit, delete, and search rich-text posts (Editor.js)
- **Comments & Likes** — readers can comment on and like articles
- **User roles** — `guest`, `author`, `admin`; role controls write access and dashboard visibility
- **User profiles** — extended profiles with bio, work experience, qualifications, and education
- **Admin panel** — manage users, articles, comments, themes, and site settings
- **Theme management** — create and activate custom CSS themes from the admin panel
- **Site settings** — configure site name, logo, and open/closed registration

---

## Prerequisites

### Backend — `uv`

The backend uses [`uv`](https://github.com/astral-sh/uv) to manage the Python environment.

Install it if you don't have it:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Verify:

```bash
uv --version
```

### Frontend — Node.js ≥ 20.9.0

Next.js 16 requires **Node.js 20.9.0 or higher**. The system default Node (e.g. the Debian/Ubuntu apt package) is often v18, which will cause this error on startup:

```
You are using Node.js 18.x.x. For Next.js, Node.js version ">=20.9.0" is required.
```

Use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions:

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# Then reload your shell
source ~/.bashrc   # or source ~/.zshrc

# Install and use Node 24 (LTS)
nvm install 24
nvm use 24

# Verify
node --version   # should print v24.x.x
```

> **Important:** `nvm` is loaded via your shell profile (`.bashrc` / `.zshrc`). It is NOT available in non-interactive shells unless you explicitly source it. See the startup commands below.

---

## Starting the Backend

The `uv` project root is `backend/`, so you **must run from the `backend/` directory** (not the repo root). Running `uv run` from the repo root will fail with `ModuleNotFoundError: No module named 'uvicorn'` because `uv` won't find the `pyproject.toml`.

```bash
cd backend
uv run python main.py
```

Expected output:

```
INFO:     Will watch for changes in these directories: ['...']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [...] using WatchFiles
INFO:     Application startup complete.
```

On first run, `backend/test.db` (SQLite) is created automatically. To reset the database, delete that file and restart the server.

---

## Starting the Frontend

Because `nvm` is not available in non-interactive shells, you need to source it explicitly before running npm commands in scripts or new terminals:

```bash
source ~/.nvm/nvm.sh
nvm use 24

cd frontend
npm run dev
```

Expected output:

```
▲ Next.js 16.x.x (Turbopack)
- Local:    http://localhost:3000
- Network:  http://192.168.x.x:3000

✓ Starting...
✓ Ready in ...ms
```

If you haven't installed dependencies yet (fresh clone):

```bash
cd frontend
npm install
```

---

## Running Both Together

Open two terminal tabs:

**Terminal 1 — Backend:**

```bash
cd /path/to/blog/backend
uv run python main.py
```

**Terminal 2 — Frontend:**

```bash
source ~/.nvm/nvm.sh
nvm use 24
cd /path/to/blog/frontend
npm run dev
```

---

## Common Issues & Fixes

### `ModuleNotFoundError: No module named 'uvicorn'`

**Cause:** You ran `uv run` from the repo root instead of `backend/`.  
**Fix:** `cd backend` first, then run `uv run python main.py`.

---

### `You are using Node.js 18.x.x. For Next.js, Node.js version ">=20.9.0" is required.`

**Cause:** The system Node.js (installed via apt) is v18.  
**Fix:** Use nvm to switch to Node 24:

```bash
source ~/.nvm/nvm.sh && nvm use 24
```

---

### `nvm: command not found` in a terminal or script

**Cause:** `nvm` is sourced in interactive shell profiles (`.bashrc` / `.zshrc`) but not in non-interactive shells.  
**Fix:** Explicitly source it before use:

```bash
source ~/.nvm/nvm.sh
```

---

### Backend `VIRTUAL_ENV` warning

You may see this warning when starting the backend:

```
warning: `VIRTUAL_ENV=/usr` does not match the project environment path `.venv` and will be ignored
```

This is harmless. It means `uv` is ignoring a system-level virtual environment and using the project's own `.venv` as expected.

---

## Project Structure

```
blog/
├── backend/                      # FastAPI app
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── articles.py       # Articles CRUD, likes, comments
│   │   │   ├── admin.py          # Admin: users, themes, stats, site settings
│   │   │   ├── author.py         # Author-specific endpoints
│   │   │   └── profile.py        # User profile, experience, qualifications
│   │   ├── app.py                # App entry point, CORS, static files
│   │   ├── core/users.py         # fastapi-users auth wiring
│   │   ├── database/db.py        # SQLAlchemy models & async engine
│   │   ├── models/               # Pydantic request/response schemas
│   │   └── services/
│   │       ├── articles.py       # Articles business logic
│   │       ├── admin.py          # Admin business logic
│   │       ├── profile.py        # Profile business logic
│   │       ├── site_settings.py  # Site config management
│   │       └── theme.py          # Theme management
│   ├── alembic/                  # Database migrations
│   ├── uploads/                  # Uploaded files (logo, etc.) — served at /uploads
│   ├── main.py                   # Uvicorn entrypoint
│   ├── pyproject.toml            # Python dependencies (uv)
│   └── test.db                   # SQLite DB (auto-created, gitignored)
│
├── frontend/                     # Next.js 16 app
│   ├── app/
│   │   ├── (auth)/               # Login, register, forgot-password
│   │   ├── (blog)/               # Feed, article view, create, update, search,
│   │   │   │                     #   dashboard, profile
│   │   │   └── components/       # NavLinks, ArticleInteractions, etc.
│   │   ├── (admin)/              # Admin panel (superuser only)
│   │   │   └── admin/
│   │   │       ├── page.js       # Admin dashboard
│   │   │       ├── articles/     # Article management
│   │   │       ├── comments/     # Comment moderation
│   │   │       ├── theme/        # Theme management
│   │   │       └── users/        # User management
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # Auth state (user, token, login, logout)
│   │   ├── _lib/
│   │   │   ├── api_callout.js    # Fetch wrappers → backend API
│   │   │   ├── theme.ts          # Theme utilities
│   │   │   └── utility.js        # JWT helpers, date utils
│   │   └── components/
│   │       ├── BackButton.tsx    # Shared back navigation
│   │       └── Editorjs.js       # Editor.js rich-text editor
│   └── package.json
│
├── deploy/                       # Deployment config
│   ├── nginx.conf.template       # Nginx reverse-proxy config
│   ├── supervisord.conf          # Supervisor process manager
│   └── start.sh                  # Container startup script
│
├── docker-compose.yml            # Local Docker setup (Postgres + backend + frontend)
└── Dockerfile                    # Single-container production build
```

---

## Configuration

| Variable       | Default                          | Where                              |
|----------------|----------------------------------|------------------------------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./test.db`  | `backend/app/database/db.py`       |
| `SECRET`       | `dev-secret-change-me`           | `backend/app/core/users.py`        |
| `FRONTEND_URL` | `http://localhost:3000`          | `backend/app/app.py` (CORS)        |
| API base URL   | `http://localhost:8000`          | `frontend/app/_lib/api_callout.js` |

Override `DATABASE_URL`, `SECRET`, and `FRONTEND_URL` via environment variables or a `backend/.env` file (loaded automatically by `python-dotenv`).
