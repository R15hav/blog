# Render Deployment Guide — Single-Image Blueprint

This project deploys to Render as **one Web Service plus one managed Postgres database**, defined in [`render.yaml`](render.yaml):

| Service | Type | What it runs |
|---|---|---|
| `blog-db` | Managed PostgreSQL | Render-managed database |
| `blog-app` | Web Service (Docker) | nginx + supervisord fronting FastAPI **and** Next.js in a single container |

Nginx is the only public listener on the container. It routes:

- `/api/v1/*`, `/auth/*`, `/users/*`, `/uploads/*`, `/docs`, `/openapi.json` → FastAPI (backend)
- everything else → Next.js (frontend)
- `/healthz` → backend health endpoint (used by Render's health check)

Because the browser hits a single origin, the frontend issues **relative** API calls (`/api/v1/...`) and `NEXT_PUBLIC_API_URL` is intentionally unset.

Render reads `render.yaml` and provisions everything automatically — no manual service setup.

---

## Prerequisites

- Code pushed to a GitHub repository
- A [Render](https://render.com) account (free tier works)

---

## Step 1 — Deploy via Blueprint

1. Render dashboard → **New +** → **Blueprint**.
2. Connect your GitHub account if needed, then select this repository.
3. Render detects `render.yaml` and previews the database + service it will create.
4. Click **Apply**. Render provisions the database first, then builds the root [`Dockerfile`](Dockerfile) (build context = repo root) and starts `blog-app`.

> The first build takes 5–10 minutes (Next.js build + Python deps). Watch the build logs from the service page.

> **Note on service URLs**: Render appends a random suffix when a name is already taken (e.g. `blog-app-2xzu.onrender.com`). Note your actual URL — you will need it in Step 2.

---

## Step 2 — Set FRONTEND_URL (and optionally FIRST_ADMIN_EMAIL)

After the first deploy, the service is reachable but `FRONTEND_URL` is unset. Same-origin requests work without it, but you should set it explicitly so CORS is honest if you later add a custom domain or a CDN in front.

1. Go to **blog-app** → **Environment**.
2. Set:

   | Key | Value |
   |---|---|
   | `FRONTEND_URL` | `https://blog-app-xxxx.onrender.com` (your service URL) |
   | `FIRST_ADMIN_EMAIL` *(optional)* | the email of the account you want auto-promoted to admin on every startup |

3. **Save Changes** — Render redeploys.

`DATABASE_URL` and `SECRET` are wired automatically by `render.yaml` (database connection string + auto-generated JWT secret). Do not set them by hand.

---

## Step 3 — Create the first admin user

You have two options.

### Option A — Auto-promote via `FIRST_ADMIN_EMAIL` (easiest)

1. Go to `https://blog-app-xxxx.onrender.com/register` and create an account with the email you want to use as admin. The application hashes the password correctly.
2. Set `FIRST_ADMIN_EMAIL` on **blog-app** to that same email and save. Render redeploys.
3. On startup, the lifespan handler in [`backend/app/app.py`](backend/app/app.py) finds that user and sets `is_superuser=true`, `is_active=true`, `role='admin'`.
4. Sign in at `/login`. You now have access to `/admin`.

### Option B — Promote via the database (no env-var change needed)

Useful if you cannot redeploy or want to avoid the implicit promotion on every boot.

1. Register an account at `/register` as above.
2. **blog-db** → **Info** → copy the **External Connection String** (`postgresql://blog_user:PASSWORD@HOST/blog_db`).
3. Connect with [TablePlus](https://tableplus.com), DBeaver, or `psql`. Enable SSL (Render requires it).
4. Run:

   ```sql
   UPDATE users
   SET is_superuser = true,
       is_active    = true,
       role         = 'admin'
   WHERE email = 'your@email.com';
   ```

5. Commit (`Cmd+S` / `Ctrl+S` in TablePlus — it does not auto-commit).
6. Sign in at `/login`.

---

## Step 4 — Verify

Once **blog-app** shows a green **Live** status, all of these should work:

| Check | URL |
|---|---|
| Frontend home page | `https://blog-app-xxxx.onrender.com/` |
| Register | `https://blog-app-xxxx.onrender.com/register` |
| Login | `https://blog-app-xxxx.onrender.com/login` |
| Admin panel | `https://blog-app-xxxx.onrender.com/admin` |
| FastAPI interactive docs | `https://blog-app-xxxx.onrender.com/docs` |
| Public site config | `https://blog-app-xxxx.onrender.com/api/v1/settings` |
| Health check | `https://blog-app-xxxx.onrender.com/healthz` |

Replace `blog-app-xxxx` with your actual service slug.

---

## Redeploying after code changes

Render redeploys automatically on push to the connected branch (`master`). For a manual redeploy: service page → **Manual Deploy** → **Deploy latest commit**.

---

## Persistent uploads

`render.yaml` mounts a 1 GB Disk at `/app/backend/uploads`. Logo and avatar uploads written by the admin panel survive redeploys and image rebuilds. If you need more space, bump `disk.sizeGB` in `render.yaml` (paid plans only above 1 GB).

---

## Database migrations

Alembic is configured in [`backend/alembic`](backend/alembic). [`backend/app/app.py`](backend/app/app.py) also runs `create_db_and_tables()` on startup as a safety net for fresh databases — sufficient for first deploy but **not** for schema changes against an existing DB.

For schema changes against an existing DB:

1. Generate a migration locally: `cd backend && uv run alembic revision --autogenerate -m "your change"`.
2. Commit and push. The next Render deploy ships the new revision file.
3. Apply it. Either:
   - Open a shell on the running container (Render dashboard → service → **Shell** tab, or `render exec <service-id> -- bash`) and run `cd /app/backend && alembic upgrade head`, **or**
   - Add a pre-deploy step / start-command wrapper that runs `alembic upgrade head` before launching supervisord. (Render's pre-deploy command setting can run `cd /app/backend && alembic upgrade head`.)

> Render's **Shell** tab is available on paid plans. On free tier you can either upgrade temporarily, run migrations from a one-off Job, or apply them directly with `psql` against the External Connection String.

---

## Debugging the running container

- **Logs**: service page → **Logs** tab, live tail.
- **Shell** (paid plan): service page → **Shell** tab, or `render exec <service-id> -- bash`. Useful for `alembic upgrade head`, inspecting `/app/backend/uploads`, or running `curl localhost:8000/healthz` from inside the container.
- **Metrics**: service page → **Metrics** tab for CPU / memory / bandwidth.

---

## Environment variable reference

### blog-app

| Variable | Set by | Description |
|---|---|---|
| `DATABASE_URL` | `render.yaml` (auto from `blog-db`) | PostgreSQL connection string. The backend normaliser converts it to `postgresql+asyncpg://`. |
| `SECRET` | `render.yaml` (auto-generated) | JWT signing secret. Generated once at service creation; rotating it invalidates every issued token. |
| `FRONTEND_URL` | You (Step 2) | Public URL of the service. Used as the CORS allow-origin. |
| `FIRST_ADMIN_EMAIL` | You (Step 2, optional) | If set, the user with this email is promoted to admin on every startup. |
| `PYTHONUNBUFFERED` | `render.yaml` | Set to `1` so Python log output is live in Render's log viewer. |

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `HOSTNAME`, and `NODE_ENV` are intentionally **not** set here. The frontend issues relative API calls (so it does not need a baked-in API origin) and the rest are handled inside the container image.

---

## Caveats

- **Cold starts on free tier**: Render free services spin down after 15 minutes of inactivity. The first request after that takes 30–60 seconds. Upgrade to a paid plan to disable spin-down.
- **Free PostgreSQL expiry**: The free Render PostgreSQL database is deleted after 90 days. Export your data or upgrade to Starter before then.
- **URL suffix**: Render appends a random slug to service names when the plain name is taken. Update `FRONTEND_URL` accordingly if your URL is not `https://blog-app.onrender.com`.
- **Render Shell is paid**: Free tier cannot open an interactive shell. For DB work, use the External Connection String with a GUI/`psql`. For migrations, see the section above.
- **Single-container limits**: Backend + frontend share one container's CPU and memory. If the Next.js renderer or FastAPI worker becomes a bottleneck, split them back into separate Render services (or move the frontend to a static host) — the previous multi-service `render.yaml` is in git history if you need a starting point.
