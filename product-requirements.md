# Product Requirements — Open-Source Blog Platform

## Vision

A barebone skeleton blogging platform with intentionally minimal built-in CSS. The primary selling point is **live theme switching**: an administrator can paste any external CSS URL and instantly change the visual appearance for every visitor — no redeploy, no code change required. The platform also includes a structured author profile system (bio, work experience, qualifications, school education) and fine-grained admin controls over users, content, and site-wide settings.

---

## User Roles

| Role | Entry | Capabilities |
|---|---|---|
| **Admin** | First user seeded via `FIRST_ADMIN_EMAIL` env (auto-promoted on startup), or `is_superuser` set in DB | Full control: user management, all articles, comment moderation, theme configuration, site settings, logo upload |
| **Author** | Admin promotes a Guest via `PATCH /api/v1/admin/users/{id}/role` | Create/edit/delete own articles; like and comment on any article; manage own profile; access author dashboard |
| **Guest** | Self-registers → admin activates (`is_active=True`); `role` stays `"guest"` | Read published articles; like and comment on any article; manage own profile. Cannot write articles or access the author dashboard |
| **Visitor** | No account needed | Read published articles, view like counts and comments, use search |

New registrations arrive as inactive (`is_active=False`) with `role="guest"`. The admin activates the user from the dashboard before they can log in. An activated user begins as a Guest; admin must separately promote them to Author for write access. The `allow_registration` site setting can disable the self-register form entirely.

---

## Feature Requirements

### 1. Public Blog

| # | Requirement |
|---|---|
| 1.1 | Article list on home page showing article title, published date, and author |
| 1.2 | Individual article view rendering Editor.js JSON content |
| 1.3 | Search by article title (partial match, case-insensitive) |
| 1.4 | Only `published=true` articles visible to unauthenticated visitors |
| 1.5 | Active theme CSS URL injected as `<link>` tag server-side on every blog page load |
| 1.6 | Like count displayed on article view; total likes fetched from `GET /api/v1/articles/{id}/likes` |
| 1.7 | Comment thread displayed on article view; comments fetched from `GET /api/v1/articles/{id}/comments` |
| 1.8 | `sitemap.xml` generated at request time from published articles via `GET /api/v1/sitemap/articles` |
| 1.9 | `robots.txt` generated at request time; disallows `/admin/*`, `/dashboard`, `/profile` |
| 1.10 | OpenGraph and Twitter card metadata on article pages sourced from `SiteConfig` (`og_title`, `og_description`, `og_image_url`) and per-article data |

### 2. Authentication & Registration

| # | Requirement |
|---|---|
| 2.1 | Self-registration form (email + password); account lands inactive after submit; blocked when `allow_registration=false` |
| 2.2 | "Pending approval" message shown after successful registration |
| 2.3 | hCaptcha widget rendered on register and login forms when `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` is set; token verified backend-side when `HCAPTCHA_ENABLED=true` |
| 2.4 | Login via custom `POST /auth/jwt/login` (form-encoded, includes optional `hcaptcha_token`); JWT stored in `localStorage` |
| 2.5 | Logout clears token and redirects to home |
| 2.6 | Password reset flow via fastapi-users built-in (`POST /auth/forgot-password`, `POST /auth/reset-password`); reset token returned in API response (no SMTP) |
| 2.7 | `FIRST_ADMIN_EMAIL` env auto-promotes that account to `is_superuser=True`, `role="admin"`, `is_active=True` on every backend startup |
| 2.8 | Newly activated users start as Guests (`role="guest"`); admin must explicitly promote to Author (`role="author"`) for write access via `PATCH /api/v1/admin/users/{id}/role` |

### 3. Article Editor (Authors)

| # | Requirement |
|---|---|
| 3.1 | Dedicated title field (separate from Editor.js content) |
| 3.2 | Rich content editor using Editor.js (headers, lists, code, tables, quotes, embeds, alerts, images via URL) |
| 3.3 | `published` toggle (draft vs published); stored as string `"true"`/`"false"` in `Post.published` |
| 3.4 | Save creates (`POST /api/v1/create-article`) or updates (`PUT /api/v1/update-article/{id}`) article; `owner_id` derived from JWT — never from client payload |
| 3.5 | Authors can only edit/delete their own articles; admins can edit/delete any article |
| 3.6 | Editor.js initialized with `reactStrictMode: false` to prevent double-init (intentional; do not re-enable Strict Mode) |

### 4. Engagement

| # | Requirement |
|---|---|
| 4.1 | Authenticated users (Guest and above) can toggle a like on any article via `POST /api/v1/articles/{id}/like`; backend enforces per-user uniqueness |
| 4.2 | Like count publicly readable via `GET /api/v1/articles/{id}/likes` |
| 4.3 | Authenticated users (Guest and above) can post a comment on any article via `POST /api/v1/articles/{id}/comments` |
| 4.4 | Comments publicly readable via `GET /api/v1/articles/{id}/comments` |
| 4.5 | Comment author or any superuser can delete a comment via `DELETE /api/v1/articles/{id}/comments/{comment_id}` |

### 5. User Profiles

| # | Requirement |
|---|---|
| 5.1 | Each user has one `UserProfile` record; fields: `bio`, `contact`, `location`, `gender`, `headline` |
| 5.2 | Authenticated user reads/updates own profile via `GET /PUT /api/v1/profile/me` |
| 5.3 | Work experience entries (company name, designation, years, months) — create, edit, delete via `/api/v1/profile/experience[/{exp_id}]` |
| 5.4 | Qualification entries (institution, degree, field of study, year) — create, edit, delete via `/api/v1/profile/qualification[/{qual_id}]` |
| 5.5 | School education entries (grade, school name, board, percentage, year) — create or update, delete via `/api/v1/profile/school[/{school_id}]` |

### 6. Author Dashboard

| # | Requirement |
|---|---|
| 6.1 | Author stats (article count, total likes, total comments) via `GET /api/v1/author/stats` |
| 6.2 | Own articles list with title, status, date via `GET /api/v1/author/articles` |
| 6.3 | Comments on own articles (with article title, commenter, body) via `GET /api/v1/author/comments` |

### 7. Admin Dashboard (`/admin/*`)

#### 7a. User Management

| # | Requirement |
|---|---|
| 7.1 | List all registered users with email, status (active/inactive), and role via `GET /api/v1/admin/users` |
| 7.2 | Activate or deactivate individual users via `PATCH /api/v1/admin/users/{id}/activate` and `/deactivate` |
| 7.2a | Set a user's role via `PATCH /api/v1/admin/users/{id}/role` (body: `{"role":"guest"}` or `{"role":"author"}`). Accepted values are `guest` and `author` only — `admin` is rejected with 422. Self-change returns 400. Attempting to change a superuser's role via this endpoint returns 400 ("Cannot change role of a superuser via this endpoint."). Admin promotion stays a manual operation (`FIRST_ADMIN_EMAIL` startup env or direct DB update); this limits blast radius from a compromised admin account. |

#### 7b. Article Management

| # | Requirement |
|---|---|
| 7.3 | List all articles (all authors) with title, author, status, date via `GET /api/v1/admin/articles` |
| 7.4 | Admin can edit any article (not just own) |
| 7.5 | Admin can delete any article |

#### 7c. Comment Moderation

| # | Requirement |
|---|---|
| 7.6 | List all comments across all articles (paginated, filterable) via `GET /api/v1/admin/comments` |
| 7.7 | Admin can delete any comment via `DELETE /api/v1/articles/{id}/comments/{comment_id}` (superuser path in shared service) |

#### 7d. Theme Management *(the selling point)*

| # | Requirement |
|---|---|
| 7.8 | Add a named theme by pasting an external CSS URL via `POST /api/v1/admin/themes` |
| 7.9 | List all saved themes with name, URL, and active status via `GET /api/v1/admin/themes` |
| 7.10 | Set any saved theme as the active theme with one click via `PUT /api/v1/admin/themes/{id}/activate` |
| 7.11 | Delete a saved theme via `DELETE /api/v1/admin/themes/{id}` |
| 7.12 | Exactly one theme is active at a time; activating one deactivates all others |
| 7.13 | Setting a theme to active takes effect for all visitors immediately (server-side injection, no CDN cache to clear) |

#### 7e. Site Settings

| # | Requirement |
|---|---|
| 7.14 | Singleton `SiteConfig` row stores: `site_name`, `site_description`, `site_url`, `logo_url`, `allow_registration`, `og_title`, `og_description`, `og_image_url` |
| 7.15 | Admin reads/updates site settings via `GET /PUT /api/v1/admin/settings`; public settings readable at `GET /api/v1/settings` |
| 7.16 | Logo uploaded as a file via `POST /api/v1/admin/upload-logo`; stored in `backend/uploads/` (persistent volume in production); served at `/uploads/` |
| 7.17 | `allow_registration=false` hides the register link and returns an error on `POST /auth/register` |
| 7.18 | Admin stats (total users, articles, comments, likes) available at `GET /api/v1/admin/stats` |

### 8. SEO

| # | Requirement |
|---|---|
| 8.1 | `sitemap.xml` lists all published article URLs; data fetched server-side from `GET /api/v1/sitemap/articles` at request time |
| 8.2 | Site base URL for sitemap comes from `NEXT_PUBLIC_APP_URL` env (falls back to `http://localhost:3000`) |
| 8.3 | `robots.txt` disallows admin and author paths; `Sitemap:` directive points to `{APP_URL}/sitemap.xml` |
| 8.4 | Blog layout fetches site name/description/OG fields from `GET /api/v1/settings` (revalidated every 60 s) and injects them as `<meta>` tags |
| 8.5 | Individual article pages generate per-article OG/Twitter metadata (title, description, URL) |

---

## Technical Constraints

- **Backend**: FastAPI + async SQLAlchemy + fastapi-users (JWT); Python 3.12+; managed via `uv`
- **Frontend**: Next.js 16 App Router (React 19, TypeScript layouts, JS pages); Node ≥ 20.9.0 required
- **Content editor**: Editor.js — content stored as JSON string in `Post.content`; image tool uses `@editorjs/simple-image` (URL-based, no file upload inside editor)
- **Database**: SQLite for local dev (default); PostgreSQL for production — configured via `DATABASE_URL` env var; schema managed via Alembic migrations
- **Auth token**: Bearer JWT; 1-hour lifetime; secret from `SECRET` env var
- **Article ownership**: `Post.owner_id` is always set from the authenticated user's JWT on the backend — never accepted from the request body
- **Theme mechanism**: `GET /api/v1/theme/active` (public) returns the active CSS URL; `(blog)/layout.tsx` server component fetches this on every request and injects `<link rel="stylesheet">` into `<head>`
- **hCaptcha contract**: backend reads `HCAPTCHA_ENABLED`, `HCAPTCHA_SECRET`, `HCAPTCHA_VERIFY_URL` (defaults to `https://api.hcaptcha.com/siteverify`); frontend reads `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` — when unset, widget is hidden and token is omitted from requests; custom login/register routes replace fastapi-users built-ins to gate on hCaptcha
- **Custom auth routes**: `POST /auth/jwt/login` and `POST /auth/register` are custom implementations (not fastapi-users generated) to support optional hCaptcha verification; fastapi-users reset-password and verify routers are retained unchanged
- **Deployment target**: single-container production image (root `Dockerfile`); nginx + supervisord front FastAPI on loopback `:8000` and Next.js standalone on loopback `:3000`; only nginx port (`$PORT`, default `8080`) is public; healthcheck at `/healthz`

---

## Out of Scope (v1)

- Email sending — password reset token is returned directly in the API response; no SMTP client is configured anywhere in the codebase
- Multi-language / i18n — no `next-intl`, `react-i18next`, or equivalent is installed or used
- Analytics — no GA, Plausible, Mixpanel, or similar integration exists
- RSS / Atom feed — no feed generation routes or libraries present
- Inline image upload inside Editor.js — the image tool accepts a URL only (`@editorjs/simple-image`); there is no file-upload endpoint wired to the editor
- Multi-tenant / multi-blog — `SiteConfig` is a singleton (one row per deployment); no per-tenant isolation exists

---

## Deployment

| Mode | Description | Public port |
|---|---|---|
| **Production (single container)** | Root `Dockerfile`: three-stage build produces one image running FastAPI (loopback `:8000`), Next.js standalone (loopback `:3000`), and nginx under supervisord | `$PORT` (default `8080`) |
| **Render** | `render.yaml` blueprint: one web service (Docker, root Dockerfile) + one managed Postgres + one 1 GB persistent disk mounted at `/app/backend/uploads` | Render-assigned HTTPS |
| **Local Docker Compose** | `docker-compose.yml`: `db` (Postgres, internal only) + `app` (consolidated image); published `8080:8080` | `8080` |
| **Local dev (no Docker)** | `cd backend && uv run python main.py` (`:8000`) + `cd frontend && npm run dev` (`:3000`) | `8000` / `3000` |

**Backend env vars** (`backend/.env`): `SECRET`, `DATABASE_URL`, `FRONTEND_URL`, `FIRST_ADMIN_EMAIL`, `HCAPTCHA_ENABLED`, `HCAPTCHA_SECRET`, `HCAPTCHA_VERIFY_URL`

**Frontend env vars** (`frontend/.env.local`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`

All secrets via `.env` files — never committed.
