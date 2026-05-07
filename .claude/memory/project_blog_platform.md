---
name: Blog platform project state
description: Production implementation status for the open-source blog platform
type: project
originSessionId: 92ab587d-af9d-4283-ab52-a85e8dc962ce
---
Full-stack blog platform implementation completed (2026-04-29). All 7 phases done.

**Why:** User wants an open-source barebones blog whose selling point is live CSS theme switching via URL injection.

**Architecture:**
- Backend: FastAPI + async SQLAlchemy + fastapi-users JWT + Alembic; runs on port 8000
- Frontend: Next.js 16 App Router (React 19); runs on port 3000
- DB: SQLite for dev, PostgreSQL for prod (docker-compose)

**Key decisions implemented:**
- Theme: admin pastes CSS URL → stored in `theme_configs` table → `<link>` injected in `(blog)/layout.tsx` server-side with 60s revalidation
- Users: self-register → `is_active=False` via `on_after_register` → admin activates from `/admin/users`
- Roles: `is_superuser` flag (fastapi-users built-in); admin redirected to `/admin/users` on login
- `Post.owner_id` never accepted from client; always set from JWT on backend (security fix)
- Admin can edit/delete any article; authors only their own

**New files created:**
- `backend/app/services/theme.py`, `admin.py`
- `backend/app/api/v1/admin.py`
- `backend/app/models/theme.py`
- `backend/alembic/` (Alembic setup + initial migration)
- `backend/.env.example`, `backend/Dockerfile`
- `frontend/app/context/AuthContext.js`
- `frontend/app/(admin)/` route group (layout, AdminGuard, users, articles, theme pages)
- `frontend/app/(blog)/article/[articleId]/page.js` (article detail view)
- `frontend/Dockerfile`, `docker-compose.yml`
- `PRODUCT_REQUIREMENTS.md`

**How to apply:** When resuming work on this project, check these files for current state before suggesting changes. Admin dashboard at `/admin/*` requires `is_superuser=True`.
