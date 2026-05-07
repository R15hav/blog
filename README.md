# Paper Blog

An open-source blog platform with **live theme switching**, **rich Editor.js content**, **role-based authoring**, and a **single-container deploy story**. FastAPI backend + Next.js 16 frontend, behind one nginx in production.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.124-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg)](https://nextjs.org)
[![Python](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org)
[![Node](https://img.shields.io/badge/node-20.9+-339933.svg)](https://nodejs.org)

📖 **Full documentation**: open [`user-manual/index.html`](user-manual/index.html) in a browser, or jump straight to:
- 👤 **[User Manual](user-manual/guide.html#um-overview)** — read articles, write posts, manage your site, deploy your own instance
- 🛠️ **[Contributor Guide](user-manual/guide.html#cg-overview)** — architecture, local setup, gotchas, API reference, how to send a PR

---

## Features

- **Articles** — create, edit, search rich-text posts (Editor.js with 12+ block tools)
- **Comments & Likes** — readers can engage with articles
- **Role-based access** — `guest`, `author`, `admin`, plus a `is_superuser` flag; routes gated by three layers (`current_active_user` / `current_author_or_admin` / `current_superuser`)
- **User profiles** — bio, work experience, qualifications, school education
- **Admin panel** — users, articles, comments, themes, site settings, stats
- **Theme switching** — paste a CSS URL into the admin panel, every visitor sees it within 60s. No redeploy
- **SEO** — server-rendered metadata, OG tags, sitemap, robots.txt
- **Single-container deploy** — one image runs nginx + FastAPI + Next.js + supervisord; works on Render, any Docker host, or `docker compose up`

---

## Quick start (local dev)

You need **Python 3.12+**, **Node 20.9+**, and [`uv`](https://github.com/astral-sh/uv).

```bash
# Install uv if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# Use Node 20+ (most repos use nvm)
nvm install 20 && nvm use 20

# Clone and run
git clone https://github.com/R15hav/blog.git
cd blog
```

Then in two terminals:

| Terminal | Command | Serves |
|---|---|---|
| Backend | `cd backend && uv run uvicorn app.app:app --reload --port 8000` | http://localhost:8000 |
| Frontend | `cd frontend && npm install && npm run dev` | http://localhost:3000 |

Default `DATABASE_URL` is SQLite (`backend/test.db`, auto-created) — no Postgres needed for first run.

> ⚠️ Run the backend from `backend/`, **not** the repo root. `uv` looks for `pyproject.toml` in the current directory; running from the root produces `ModuleNotFoundError: No module named 'uvicorn'`.

> ⚠️ The system Node on Debian/Ubuntu is often v18, which Next.js 16 rejects with `version ">=20.9.0" is required`. Use [nvm](https://github.com/nvm-sh/nvm).

---

## Deployment

| How | What you get | Guide |
|---|---|---|
| **Render (Web Service + Docker)** | Hosted, with managed Postgres and a persistent disk for uploads | [render-deploy.md](render-deploy.md) |
| **`docker compose up`** | Postgres + the consolidated app on `localhost:8080` | `docker compose up -d` |
| **Self-host (any Docker host)** | One image you can run anywhere | See [user-manual/guide.html#um-deploy-docker](user-manual/guide.html#um-deploy-docker) |

The production artifact is a **single image** (root [`Dockerfile`](Dockerfile)) running nginx on `$PORT`, FastAPI on `127.0.0.1:8000`, and Next.js on `127.0.0.1:3000` under supervisord. Only nginx is exposed publicly.

---

## Project layout

```
blog/
├── backend/             FastAPI app (api/v1 → services → database/db.py)
├── frontend/            Next.js 16 App Router ((auth), (blog), (admin) groups)
├── deploy/              nginx.conf.template, supervisord.conf, start.sh
├── user-manual/         Open this in a browser — full docs site
├── Dockerfile           Multi-stage: frontend-builder → backend-builder → runtime
├── docker-compose.yml   db + app
├── render.yaml          Render Blueprint (alternative to manual Web Service flow)
└── CLAUDE.md            Architectural notes (also useful for new contributors)
```

For a deep-dive into each subsystem (auth flow, theme system, SiteConfig, single-image topology, gotchas), see the **[Contributor Guide](user-manual/guide.html#cg-architecture)**.

---

## Configuration

| Variable | Default | Where it's read |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./test.db` | [`backend/app/database/db.py`](backend/app/database/db.py) |
| `SECRET` | `dev-secret-change-me` | [`backend/app/core/users.py`](backend/app/core/users.py) — **must override in prod** |
| `FRONTEND_URL` | `http://localhost:3000` | [`backend/app/app.py`](backend/app/app.py) (CORS allow-origin; optional in single-image since same-origin) |
| `FIRST_ADMIN_EMAIL` | (unset) | [`backend/app/app.py`](backend/app/app.py) — auto-promotes that user to superuser+admin on every startup |
| `PORT` | `8080` | nginx public listen port (Render overrides) |

`backend/.env` is auto-loaded by `python-dotenv` for local dev. In production, env vars come from the orchestrator (Render dashboard, `docker run -e`, or `docker-compose.yml`).

For the full list (including what's *deliberately* removed in single-image mode), see [`user-manual/guide.html#um-deploy-env`](user-manual/guide.html#um-deploy-env).

---

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the quick-start, branch/commit conventions, and the link to the deep-dive contributor guide. By contributing you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

For security issues, please **don't** open a public issue — see [SECURITY.md](SECURITY.md).

---

## License

[MIT](LICENSE) © 2026 R15hav
