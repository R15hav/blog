# Product Requirements — Open-Source Blog Platform

## Vision

A barebone skeleton blogging platform with intentionally minimal built-in CSS. The primary selling point is **live theme switching**: an administrator can paste any external CSS URL and instantly change the visual appearance for every visitor — no redeploy, no code change required.

---

## User Roles

| Role | Entry | Capabilities |
|---|---|---|
| **Admin** | First user seeded, or `is_superuser` set in DB | Full control: user management, all articles, theme configuration |
| **Author** | Self-registers → admin approves | Create, edit, delete their own articles |
| **Visitor** | No account needed | Read published articles, use search |

New registrations arrive as inactive (`is_active=False`). The admin explicitly approves each user from the dashboard before they can log in and write.

---

## Feature Requirements

### 1. Public Blog

| # | Requirement |
|---|---|
| 1.1 | Article list on home page showing article title, published date, and author |
| 1.2 | Individual article view rendering Editor.js JSON content |
| 1.3 | Search by article title (partial match, case-insensitive) |
| 1.4 | Only `published=true` articles visible to visitors |
| 1.5 | Active theme CSS URL injected as `<link>` tag server-side on every page load |

### 2. Authentication

| # | Requirement |
|---|---|
| 2.1 | Self-registration form (email + password); account lands inactive after submit |
| 2.2 | "Pending approval" message shown after successful registration |
| 2.3 | Login with JWT; token stored in `localStorage` |
| 2.4 | Logout clears token and redirects to home |
| 2.5 | Password reset flow (via fastapi-users built-in) |

### 3. Article Editor (Authenticated Authors)

| # | Requirement |
|---|---|
| 3.1 | Dedicated title field (separate from Editor.js content) |
| 3.2 | Rich content editor using Editor.js (headers, lists, code, images, embeds, etc.) |
| 3.3 | `published` toggle (draft vs published) |
| 3.4 | Save creates or updates article; author is derived from JWT (never from client payload) |
| 3.5 | Authors can only edit/delete their own articles |

### 4. Admin Dashboard (`/admin/*`)

#### 4a. User Management
| # | Requirement |
|---|---|
| 4.1 | List all registered users with email, status (active/inactive), and role |
| 4.2 | Activate or deactivate individual users |

#### 4b. Article Management
| # | Requirement |
|---|---|
| 4.3 | List all articles (all authors) with title, author, status, date |
| 4.4 | Admin can edit any article (not just own) |
| 4.5 | Admin can delete any article |

#### 4c. Theme Management *(the selling point)*
| # | Requirement |
|---|---|
| 4.6 | Add a named theme by pasting an external CSS URL |
| 4.7 | List all saved themes with name, URL, and active status |
| 4.8 | Set any saved theme as the active theme with one click |
| 4.9 | Delete a saved theme |
| 4.10 | Exactly one theme is active at a time; activating one deactivates all others |
| 4.11 | Setting a theme to active takes effect for all visitors immediately (server-side injection, no CDN cache to clear) |

---

## Technical Constraints

- **Backend**: FastAPI + async SQLAlchemy + fastapi-users (JWT)
- **Frontend**: Next.js 16 App Router (React 19, TypeScript layouts, JS pages)
- **Content editor**: Editor.js — content stored as JSON string in `Post.content`
- **Database**: SQLite for local dev; PostgreSQL for production (configured via `DATABASE_URL` env var)
- **Auth token**: Bearer JWT; 1-hour lifetime
- **Article ownership**: `Post.owner_id` is always set from the authenticated user's JWT on the backend — never accepted from the request body
- **Theme mechanism**: `GET /api/v1/theme/active` (public endpoint) returns the active CSS URL; the Next.js `(blog)/layout.tsx` server component fetches this on every request and injects `<link rel="stylesheet" href={url} />` into `<head>`
- **No migrations by default today → Alembic added**: schema changes go through Alembic migrations

---

## Out of Scope (v1)

- Email sending (password reset token is returned in API response for dev; hook up SMTP in v2)
- Comment system
- Media/image upload (use external URLs in Editor.js image tool)
- Multi-language / i18n
- Analytics
- RSS feed

---

## Deployment

Docker Compose with three services:

| Service | Image | Port |
|---|---|---|
| `db` | postgres:16-alpine | 5432 (internal) |
| `backend` | Python 3.12 + uv | 8000 |
| `frontend` | Node 20 Alpine (standalone build) | 3000 |

All secrets (`SECRET`, `DATABASE_URL`, `POSTGRES_*`) via `.env` files — never committed.
