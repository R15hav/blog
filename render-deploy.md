# Render Deployment Guide

This project deploys to Render as **one Web Service plus one managed Postgres database** — a single Docker container running nginx, FastAPI, and Next.js together, with the database as a separate Render resource.

There are two ways to set it up:

- **[Manual Web Service (recommended)](#manual-web-service-recommended)** — point-and-click in the Render dashboard. Most flexible, easiest to understand, and what you'll naturally extend later.
- **[Blueprint (`render.yaml`)](#alternative-blueprint-renderyaml)** — one-click apply of the included [`render.yaml`](render.yaml). Faster but less obvious what's happening.

> 💡 **Heads-up on the most common gotcha**: the Render database and the Web Service must be in the **same Render project (workspace)** for the Internal Database URL to resolve. If they're in different projects, switch the connection string to the **External** form (slightly slower, region-agnostic).

---

## Architecture (what gets deployed)

| Service | Type | What it runs |
|---|---|---|
| `blog-db` | Managed PostgreSQL | Render-managed database |
| `blog-app` | Web Service (Docker) | nginx + supervisord fronting FastAPI **and** Next.js inside one container |

Nginx is the only public listener on the container. It routes:

- `/api/v1/*`, `/auth/*`, `/users/*`, `/uploads/*`, `/docs`, `/openapi.json` → FastAPI on `127.0.0.1:8000`
- `/healthz` → 200 (used by Render's health check)
- everything else → Next.js on `127.0.0.1:3000`

Because the browser talks to a single origin, the frontend issues **relative** API calls (`/api/v1/...`) and `NEXT_PUBLIC_API_URL` is intentionally unset.

---

## Prerequisites

- Code pushed to a GitHub repository
- A [Render](https://render.com) account (free tier works for both services)
- ~5–10 minutes for the first deploy (multi-stage Docker build)

---

## Manual Web Service (recommended)

### Step 1 — Create the Postgres database first

Doing this first means the connection string is ready when you create the Web Service.

1. Render dashboard → **New +** → **PostgreSQL**.
2. Settings:
   - **Name**: `blog-db`
   - **Database**: `blog_db`
   - **User**: `blog_user`
   - **Region**: `Oregon` (any — but the Web Service must match)
   - **Plan**: `Free`
3. Click **Create Database**. Wait for status = "Available" (~30 seconds).
4. Open the database page → **Connect** panel. **Copy the Internal Database URL** — it looks like:
   ```
   postgres://blog_user:xxxxxxxx@dpg-xxxxxxxx-a/blog_db
   ```
5. **Keep this tab open** — you'll paste this URL in Step 2.

### Step 2 — Create the Web Service

1. Render dashboard → **New +** → **Web Service**.
2. Connect your GitHub account if needed, then select this repository.
3. Fill in the basic settings:

   | Field | Value |
   |---|---|
   | **Name** | `blog-app` |
   | **Region** | **Same as the database** (e.g. `Oregon`) |
   | **Branch** | `master` |
   | **Root Directory** | *(leave blank — repo root)* |
   | **Language** / Runtime | **Docker** |
   | **Dockerfile Path** | `./Dockerfile` |
   | **Docker Build Context Directory** | `.` |
   | **Instance Type** | `Free` (or higher) |

4. Click **Advanced** to expose the rest of the form. **Don't click Create yet.**

### Step 3 — Add environment variables

Under **Advanced** → **Add Environment Variable**:

| Key | Value | Notes |
|---|---|---|
| `DATABASE_URL` | *(paste the Internal Database URL from Step 1)* | The backend rewrites `postgres://` → `postgresql+asyncpg://` automatically and strips SSL query params asyncpg can't handle |
| `SECRET` | `openssl rand -hex 32` (run locally and paste the output) | JWT signing key — never reuse the dev default in production |
| `FIRST_ADMIN_EMAIL` | your admin email *(optional)* | If set, the user with this email is auto-promoted to superuser+admin on every startup. See [Step 6](#step-6--bootstrap-the-first-admin-user) |
| `FRONTEND_URL` | *(leave unset for now — see Step 5)* | Same-origin requests don't need this; only set it if you add a CDN or custom domain later |

Skip these — they're handled inside the image:

- `NEXT_PUBLIC_API_URL` (frontend uses relative URLs)
- `NEXT_PUBLIC_APP_URL`
- `PORT` (Render injects this; nginx config substitutes it at startup)
- `HOSTNAME`, `NODE_ENV` (set by supervisord per-process)

### Step 4 — Add a persistent disk for uploads

Without this, every redeploy wipes admin-uploaded logos and avatars (the upload directory lives inside the container's writable layer).

Under **Advanced** → **Add Disk**:

| Field | Value |
|---|---|
| **Name** | `uploads` |
| **Mount Path** | `/app/backend/uploads` |
| **Size (GB)** | `1` |

> Free tier permits 1 GB. Bump it on a paid plan if you expect a lot of media.

### Step 5 — Health check

Still under **Advanced**:

| Field | Value |
|---|---|
| **Health Check Path** | `/healthz` |

Nginx serves this inline (returns `ok` immediately) — Render uses it to decide when the deploy is healthy.

### Step 6 — Click "Create Web Service"

The first build takes ~5–10 minutes (multi-stage: Node → Python → final runtime with nginx + Node + uv).

Watch the **Logs** tab. A successful boot looks like:

```
[start.sh] Rendering nginx config (PORT=10000)...
[start.sh] Ensuring uploads directory exists...
[start.sh] Running alembic migrations...
INFO  [alembic.runtime.migration] Running upgrade  -> baa7cc32c3f7, initial schema
INFO  [alembic.runtime.migration] Running upgrade baa7cc32c3f7 -> 4eb5408a550e, add_role_to_user
…
[start.sh] Handing off to supervisord...
INFO supervisord started with pid 1
INFO success: backend entered RUNNING state
INFO success: frontend entered RUNNING state
INFO success: nginx entered RUNNING state
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Once **Live** with green status, the service is reachable at `https://blog-app-xxxx.onrender.com`.

### Step 7 — Bootstrap the first admin user

You have two options:

#### Option A — Auto-promote via `FIRST_ADMIN_EMAIL`

If you skipped this in Step 3, do it now:

1. Visit `https://blog-app-xxxx.onrender.com/register` and create an account with the email you want as admin.
2. **blog-app** → **Environment** → set `FIRST_ADMIN_EMAIL` to that same email → **Save Changes**.
3. Render redeploys. On boot, the lifespan handler in [`backend/app/app.py`](backend/app/app.py) finds that user and sets `is_superuser=true`, `is_active=true`, `role='admin'`.
4. Sign in at `/login`. You now have access to `/admin`.

#### Option B — Promote via SQL

Useful if you don't want a redeploy on every config change:

1. Register an account at `/register`.
2. **blog-db** → **Connect** → copy the **PSQL Command** (or use any GUI tool against the External URL).
3. Run:

   ```sql
   UPDATE users
   SET is_superuser = TRUE,
       is_active    = TRUE,
       role         = 'admin'
   WHERE email = 'your@email.com';
   ```

4. Sign in at `/login` — no service restart needed.

### Step 8 — Verify

Once **blog-app** shows green/Live:

| Check | URL |
|---|---|
| Frontend home page | `https://blog-app-xxxx.onrender.com/` |
| Health endpoint | `https://blog-app-xxxx.onrender.com/healthz` → `ok` |
| Admin panel | `https://blog-app-xxxx.onrender.com/admin` |
| FastAPI docs (Swagger) | `https://blog-app-xxxx.onrender.com/docs` |
| Public site config | `https://blog-app-xxxx.onrender.com/api/v1/settings` |

---

## Alternative: Blueprint (`render.yaml`)

The repo includes a [`render.yaml`](render.yaml) Blueprint that provisions both the database and the Web Service in one click. Use this if you want zero clicks on the env-var form.

1. Render dashboard → **New +** → **Blueprint**.
2. Connect your GitHub account if needed, then select this repository.
3. Render reads `render.yaml` and previews the database + service.
4. Click **Apply**. Render provisions the database first, then builds the Web Service.

After the first deploy:

- Set `FIRST_ADMIN_EMAIL` (Blueprint declares it as `sync: false`, so you must fill it in manually).
- Optionally set `FRONTEND_URL` to the actual service URL once Render has assigned a slug.
- `DATABASE_URL` and `SECRET` are wired automatically (the database connection string is mapped via `fromDatabase`, and `SECRET` is auto-generated).

---

## Updating after code changes

Render auto-deploys on every push to the connected branch (default: `master`). For a manual redeploy: service page → **Manual Deploy** → **Deploy latest commit**.

The container restarts cleanly: nginx → SIGTERM → drain → supervisord shuts down backend and frontend → new container boots → migrations run → traffic shifts. There's a brief unavailability window on free tier; paid plans support zero-downtime deploys.

---

## Database migrations

Alembic is configured in [`backend/alembic`](backend/alembic). The startup script [`deploy/start.sh`](deploy/start.sh) runs `alembic upgrade head` on **every** container boot — so deploying a new migration just means pushing the revision file. The migration runs before supervisord forks the app processes; if it fails, the container exits loudly (intentional — we don't want to serve a schema-mismatched app).

[`backend/app/app.py`](backend/app/app.py) also calls `create_db_and_tables()` (`metadata.create_all`) as a safety net for fresh databases. This is sufficient for first-deploy bootstrap but **does not alter** existing tables — schema changes against an existing DB always require a real migration.

To generate a migration:

```bash
cd backend
uv run alembic revision --autogenerate -m "describe your change"
# inspect backend/alembic/versions/<new_file>.py
uv run alembic upgrade head    # test locally against SQLite or local Postgres
git add backend/alembic/versions/ && git commit && git push
# Render redeploys → start.sh runs alembic upgrade head against blog-db
```

---

## Persistent uploads

The disk added in Step 4 mounts at `/app/backend/uploads`. Logo and avatar uploads written via the admin panel land here and survive redeploys.

If you outgrow 1 GB on the free tier, bump `disk.sizeGB` (paid plans only above 1 GB). For very large media, refactor [`backend/app/api/v1/admin.py`](backend/app/api/v1/admin.py)'s upload handler to write to S3 / R2 / Backblaze instead — see [user-manual/guide.html#cg-howto-route](user-manual/guide.html#cg-howto-route) for how to evolve the route.

---

## Debugging the running container

- **Logs**: service page → **Logs** tab, live tail. Includes nginx access logs, supervisord events, uvicorn output, and Next.js boot.
- **Shell** (paid plan): service page → **Shell** tab, or `render exec <service-id> -- bash`. Useful for:
  - `cd /app/backend && uv run alembic current` (check migration head)
  - `ls -la /app/backend/uploads` (inspect persisted uploads)
  - `curl localhost:8000/healthz` and `curl localhost:3000` (probe loopback services individually)
- **Metrics**: service page → **Metrics** tab — CPU, memory, bandwidth.
- **Database**: **blog-db** → **Connect** → **PSQL Command** — paste into a local terminal for ad-hoc queries.

---

## Environment variable reference

### blog-app

| Variable | Set by | Description |
|---|---|---|
| `DATABASE_URL` | You (Step 3) or `render.yaml` for Blueprint | PostgreSQL connection string. The backend normaliser converts it to `postgresql+asyncpg://` and strips `ssl=` / `sslmode=` query params (asyncpg mishandles them). SSL is added via `connect_args` instead. |
| `SECRET` | You (Step 3) or `render.yaml` (`generateValue: true`) | JWT signing secret. Rotating it invalidates every issued token. |
| `FIRST_ADMIN_EMAIL` | You (Step 3 or 7) | If set, the matching user is promoted to admin on every boot. Idempotent — safe to leave on. |
| `FRONTEND_URL` | You (optional) | CORS allow-origin. **Not needed** for the consolidated single-origin deploy; set it only if you add a custom domain or external client. |
| `PORT` | Render | Public nginx listen port. The Dockerfile defaults to `8080`; Render overrides this with whatever it has assigned. |
| `PYTHONUNBUFFERED` | `render.yaml` (Blueprint) | `1` — flushes stdout/stderr live to Render's log viewer. |

These are **deliberately not set** in this deploy mode:

- `NEXT_PUBLIC_API_URL` — leaving it unset means the frontend bundles use relative URLs (`/api/v1/...`), which nginx proxies internally
- `NEXT_PUBLIC_APP_URL` — server-side metadata generation works from request headers
- `HOSTNAME`, `NODE_ENV` — set per-process inside `deploy/supervisord.conf`

---

## Enabling hCaptcha on register and login (optional)

hCaptcha is off by default. When enabled, both the registration and login forms show a CAPTCHA widget and the backend verifies the token with hCaptcha's API before processing each request. The same three variables control both surfaces. To enable it:

### Step 1 — Get your keys

Sign in at [https://dashboard.hcaptcha.com/](https://dashboard.hcaptcha.com/) and create a site. You will get two values:

- **Site key** — public, goes into the frontend bundle
- **Secret key** — server-side only, never exposed to the browser

For a staging environment, use the official hCaptcha sandbox keys:

- Site key: `10000000-ffff-ffff-ffff-000000000001`
- Secret key: `0x0000000000000000000000000000000000000000`

### Step 2 — Set the environment variables in the Render dashboard

All three variables are declared `sync: false` in `render.yaml`, meaning they are not committed to the repo — you must set them manually in the **Environment** tab of the `blog-app` Web Service:

| Variable | Value | Notes |
|---|---|---|
| `HCAPTCHA_ENABLED` | `true` | Accepts `true`, `1`, or `yes` (case-insensitive) |
| `HCAPTCHA_SECRET` | *(your secret key)* | Server-side only — never set as a `NEXT_PUBLIC_*` variable |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | *(your site key)* | **Build-time** — see Step 3 |

### Step 3 — Redeploy (required for the site key)

`NEXT_PUBLIC_HCAPTCHA_SITE_KEY` is baked into the Next.js bundle during the Docker build. Setting it in the dashboard and **restarting** the service is not enough — you must trigger a full redeploy so the `frontend-builder` stage picks it up. Click **Manual Deploy** → **Deploy latest commit** after saving the env vars.

`HCAPTCHA_ENABLED` and `HCAPTCHA_SECRET` are read at runtime and take effect on the next restart; they do not require a rebuild.

> If `HCAPTCHA_ENABLED=true` but `HCAPTCHA_SECRET` is not set, every registration and login attempt returns a 500 error. Set both together.

---

## Troubleshooting

### `socket.gaierror: [Errno -2] Name or service not known` during alembic migrations

The DB hostname can't be resolved from the Web Service container. Three causes, in order of likelihood:

1. **Database and Web Service are in different Render projects.** The Internal URL only resolves *within* a single project. Move both into the same project, or switch to the **External Database URL** in the Web Service environment.
2. **Region mismatch** (rare, since most regions can talk to each other internally). Make sure both resources sit in the same region.
3. **Typo / extra whitespace** in the pasted `DATABASE_URL`. Open the env var, eyeball it.

To verify from the running container (paid plan / Shell tab):

```bash
echo "$DATABASE_URL" | sed 's/:[^:@]*@/:***@/'   # masks the password
getent hosts <hostname-from-DATABASE_URL>         # should print an IP, not "no such host"
```

After fixing the URL, **restart the service** — SQLAlchemy caches the engine and won't pick up the new env without a restart.

### `nginx: "daemon" directive is duplicate in /etc/nginx/nginx.conf`

Caused if `deploy/supervisord.conf` invokes nginx with `-g 'daemon off;'` while `nginx.conf` already declares `daemon off;`. Use one or the other, not both. The repo ships the conf with `daemon off;` and supervisord without `-g`.

### Container exits before serving traffic

Read the logs from `[start.sh]`:

- `[start.sh] Rendering nginx config (PORT=...)` — nginx config OK
- `nginx: configuration file ... test is successful` — config validates
- `[start.sh] Running alembic migrations...` — migration phase
- If the next non-`[start.sh]` line is a Python traceback, the migration crashed (often DB connection — see above)
- If supervisord starts but a program enters `FATAL state, too many start retries too quickly`, that program is the culprit — check the lines above for its specific error

### Free tier sleeping

Free Render Web Services spin down after **15 minutes of inactivity**. The first request after sleep takes 30–60 seconds to wake the container (cold-start). Upgrade to Starter ($7/mo at time of writing) to disable spin-down.

### Free Postgres expires after 90 days

The free Render PostgreSQL database is deleted after 90 days. Export your data with `pg_dump` (or the **Backups** tab on paid plans) before then, or upgrade to Starter.

### URL suffix surprise

Render appends a random suffix to service names when the plain name is taken (e.g. `blog-app-2xzu.onrender.com`). If you set `FRONTEND_URL` early, update it once you know the actual URL.

---

## Caveats and limits

- **Single-container CPU & memory shared** between FastAPI and Next.js. If one becomes a bottleneck, split them into separate Render services — git history (commit `9a553b3` and earlier) has the previous multi-service `render.yaml` as a starting point.
- **Render Shell is paid-only.** On free tier, do DB work via the External Connection String + `psql`/GUI, and accept that you can't `docker exec`-equivalent into the container.
- **Sub-domain only on free tier.** Custom domains (`blog.yourdomain.com`) are available on paid plans.
