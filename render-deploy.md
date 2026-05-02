# Deployment Guide — Single Container on Render

This project ships as one Docker container: nginx routes all traffic, FastAPI runs on port 8000 internally, and Next.js runs on port 3000 internally. Render's managed PostgreSQL is used as the database.

## Architecture inside the container

```
Browser → Render → nginx (port 10000)
                    ├─ /api/*      → uvicorn / FastAPI  (port 8000)
                    ├─ /auth/*     → uvicorn / FastAPI  (port 8000)
                    ├─ /users/*    → uvicorn / FastAPI  (port 8000)
                    ├─ /uploads/*  → uvicorn / FastAPI  (port 8000)
                    ├─ /docs       → uvicorn / FastAPI  (port 8000)
                    └─ /*          → Next.js node server (port 3000)
```

Everything is managed by **supervisord**. On startup, `deploy/start.sh` runs Alembic migrations and then launches all three processes.

---

## Prerequisites

- Code pushed to a GitHub repository
- A [Render](https://render.com) account (free tier is sufficient)

---

## Step 1 — Create the PostgreSQL Database

1. In the Render dashboard click **New +** → **PostgreSQL**
2. Fill in:
   - **Name**: `blog-db` (or any name you prefer)
   - **Region**: choose the one closest to you
   - **Plan**: Free (expires after 90 days) or Starter ($7/mo) for persistence
3. Click **Create Database**
4. Once created, go to the database info page and copy the **Internal Database URL**. It looks like:
   ```
   postgresql://blog_user:PASSWORD@dpg-xxxx.oregon-postgres.render.com/blog_db
   ```
5. Change the URL prefix from `postgresql://` to `postgresql+asyncpg://` — this is required by the async SQLAlchemy driver:
   ```
   postgresql+asyncpg://blog_user:PASSWORD@dpg-xxxx.oregon-postgres.render.com/blog_db
   ```
   Keep this URL — you will need it in Step 3.

---

## Step 2 — Create the Web Service

1. In the Render dashboard click **New +** → **Web Service**
2. Connect your GitHub account if you haven't already, then select this repository
3. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Name** | `blog-app` (or any name — this becomes your URL) |
   | **Root Directory** | *(leave blank)* |
   | **Environment** | **Docker** |
   | **Dockerfile Path** | `./Dockerfile` |
   | **Region** | Same region as your database |
   | **Plan** | Free |
   | **Port** | `10000` |

4. Do **not** click Create yet — continue to Step 3 to set environment variables first.

---

## Step 3 — Set Environment Variables

Still on the new service setup page, scroll down to the **Environment Variables** section and add the following:

| Key | Value | Notes |
|-----|-------|-------|
| `SECRET` | *(generated value)* | Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | `postgresql+asyncpg://...` | The URL you prepared in Step 1 |
| `FRONTEND_URL` | `https://blog-app.onrender.com` | Replace `blog-app` with the name you chose in Step 2 — Render shows the final URL on this page before you deploy |

> `NEXT_PUBLIC_API_URL` does **not** need to be set. Client-side API calls use relative URLs (`/api/v1/...`) which nginx routes to FastAPI automatically.

---

## Step 4 — Deploy

Click **Create Web Service**. Render will:

1. Pull the code from GitHub
2. Build the 3-stage Docker image (takes 3–6 minutes on first build)
3. Run `alembic upgrade head` to create all database tables
4. Start nginx, uvicorn, and the Next.js node server under supervisord

You can watch the build logs in real time on the service page. A green **Live** status means the deployment succeeded.

---

## Step 5 — Verify

Once the deploy is live, test these URLs (replace `blog-app` with your service name):

| Check | URL |
|-------|-----|
| Frontend home page | `https://blog-app.onrender.com/` |
| FastAPI interactive docs | `https://blog-app.onrender.com/docs` |
| Register a new account | `https://blog-app.onrender.com/register` |
| Login | `https://blog-app.onrender.com/login` |

---

## Redeploying after code changes

Render automatically redeploys when you push to the connected branch. To trigger a manual redeploy, go to the service page and click **Manual Deploy** → **Deploy latest commit**.

---

## Environment variable reference

### Required

| Variable | Where set | Description |
|----------|-----------|-------------|
| `SECRET` | Render env | JWT signing secret. Use a 64-character random hex string in production. |
| `DATABASE_URL` | Render env | PostgreSQL connection string. Must use the `postgresql+asyncpg://` prefix. |
| `FRONTEND_URL` | Render env | Full public URL of this service. Used by FastAPI for CORS. |

### Optional / local dev only

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `""` (empty) | Backend URL for client-side calls. Leave unset in production — empty string makes calls relative so nginx handles routing. Set to `http://localhost:8000` in `.env.local` for local development. |
| `PORT` | `10000` | Port nginx listens on. Render injects this automatically. |

---

## Local Docker test (before pushing to Render)

You can test the combined container locally before deploying:

```bash
# Build
docker build -t blog-app .

# Run (uses SQLite as fallback since DATABASE_URL is not set)
docker run -p 10000:10000 \
  -e SECRET=local-dev-secret \
  -e FRONTEND_URL=http://localhost:10000 \
  blog-app
```

Open `http://localhost:10000` in your browser.

To test against a real PostgreSQL database locally, pass the `DATABASE_URL`:

```bash
docker run -p 10000:10000 \
  -e SECRET=local-dev-secret \
  -e DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname \
  -e FRONTEND_URL=http://localhost:10000 \
  blog-app
```

---

## File overview

```
Dockerfile                  3-stage build: frontend → backend venv → runtime image
deploy/
  nginx.conf.template       nginx config; ${PORT} is substituted at container startup
  supervisord.conf          manages nginx, uvicorn, and the Next.js node process
  start.sh                  entrypoint: substitutes PORT, runs migrations, starts supervisord
```

---

## Caveats

- **Cold starts on free tier**: Render free services spin down after 15 minutes of inactivity. The first request after that takes 30–60 seconds to cold-start. Upgrade to a paid plan to disable spin-down.
- **Free PostgreSQL expiry**: The free Render PostgreSQL database is deleted after 90 days. Export your data or upgrade to Starter before then.
- **Uploaded files**: Logo uploads (`/uploads/`) are stored on the container's local disk and are lost on each redeploy. To persist them, configure an S3-compatible object store and update `backend/app/api/v1/admin.py` accordingly.
