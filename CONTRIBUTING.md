# Contributing

Thanks for your interest in contributing! This is a full-stack open-source blog platform — FastAPI backend, Next.js 16 frontend, single-image Docker deploy. Bug reports, feature ideas, and pull requests are all welcome.

## Code of Conduct

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). The short version: be kind, critique code not people, assume good faith.

## Quick start for contributors

You'll need:

- **Python 3.12+** — `python --version`
- **Node 20.9+** — `node -v` (use [nvm](https://github.com/nvm-sh/nvm); the system Node on Debian/Ubuntu is often v18 and won't work with Next.js 16)
- **uv** — Python package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Docker** — optional, only if you want to run the full single-image stack

Clone and run:

```bash
git clone https://github.com/R15hav/blog.git
cd blog

# Backend (in one terminal)
cd backend
uv run uvicorn app.app:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Backend serves at `http://localhost:8000`, frontend at `http://localhost:3000`. The default `DATABASE_URL` is SQLite (`backend/test.db`), so no Postgres setup is needed for first-run.

hCaptcha is optional for local development — the widget is skipped entirely when `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` is unset. If you want to test the full captcha flow locally, the official sandbox keys are documented in `backend/.env.example` and `frontend/.env.example`.

> ⚠️ **Run the backend from `backend/`, not the repo root.** `uv` looks for `pyproject.toml` in the current directory; running from the root produces `ModuleNotFoundError: No module named 'uvicorn'`.

## Where things live

```
backend/        FastAPI app: api/v1 routes → services → database/db.py models
frontend/       Next.js 16 App Router: (auth), (blog), (admin) route groups
deploy/         nginx.conf.template, supervisord.conf, start.sh — the consolidated runtime
Dockerfile      Multi-stage: frontend-builder → backend-builder → runtime (nginx + uvicorn + Next.js)
render.yaml     Render Blueprint for one-click cloud deploys
docker-compose.yml   Postgres + the consolidated app for full-stack local testing
user-manual/    The end-user docs site and contributor guide (this is what /guide.html serves)
```

## Detailed contributor guide

The deep-dive — architecture diagrams, auth flow, theme system, gotchas, "how to add a route", API reference, migration workflow — lives in the **Contribute** section of the docs site:

➡️ Open `user-manual/guide.html` and switch to **Contribute** mode (or jump to `guide.html#cg-overview`).

Don't duplicate that content here. This file is the GitHub-discoverable entry point that funnels you there.

## Making changes

1. **Fork** the repo and clone your fork.
2. **Branch** from `master`. Naming: `feature/short-description` for new functionality, `fix/short-description` for bug fixes, `docs/...`, `refactor/...`.
3. **Commit** in small, focused chunks. Subject line: imperative mood, lowercase verb, ≤ 72 characters. Body wraps at 72 columns. Examples:
   - `add tag support to article create form`
   - `fix race in alembic migration on cold start`
   - `docs: clarify FIRST_ADMIN_EMAIL env var`
4. **Test** locally before pushing:
   - `cd frontend && npm run lint` — must pass
   - `cd backend && uv run alembic upgrade head` against a fresh DB (delete `backend/test.db` first) — must apply cleanly
   - For UI changes, click through the affected pages in a browser
   - For backend changes, hit the affected endpoints (curl or `/docs`)
5. **Push** to your fork and **open a PR** against `master`. Fill in the PR template — the test plan is the single most useful section, please don't skip it.

## Submitting a pull request

- Target: `master`
- One PR = one logical change. Drive-by refactors mixed with feature work make review harder.
- Fill in the PR template (`.github/PULL_REQUEST_TEMPLATE.md`).
- Link the issue: `Closes #123` or `Refs #123`.
- Attach screenshots for any UI change.
- Be patient with review — most maintainers are part-time on this. Polite pings after a week of silence are fine.

## Reporting bugs

Open a **GitHub issue** using the "Bug report" template. Useful detail:

- Steps to reproduce, ideally minimal
- Expected vs actual behaviour
- Browser + OS for frontend bugs; Python + DB for backend bugs
- Deploy mode: local dev / docker compose / Render
- Relevant logs (`docker logs blog-app` or the Render logs tab)

## Reporting security issues

**Don't open a public issue for security problems.** See [SECURITY.md](SECURITY.md) for the disclosure process. Short version: email gaming.boy.fhx@gmail.com.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
