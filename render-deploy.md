# Render Deployment Guide — Blueprint (Three Services)

This project deploys to Render as three separate services defined in [`render.yaml`](render.yaml):

| Service | Type | What it runs |
|---|---|---|
| `blog-db` | Managed PostgreSQL | Render-managed database |
| `blog-backend` | Web Service (Docker) | FastAPI on port 8000 |
| `blog-frontend` | Web Service (Node.js) | Next.js on port 3000 |

Render reads `render.yaml` and creates all three automatically — no manual service setup required.

---

## Prerequisites

- Code pushed to a GitHub repository
- A [Render](https://render.com) account (free tier is sufficient)

---

## Step 1 — Deploy via Blueprint

1. In the Render dashboard click **New +** → **Blueprint**
2. Connect your GitHub account if you haven't already, then select this repository
3. Render detects `render.yaml` and previews the three services it will create
4. Click **Apply** — Render provisions the database first, then builds and deploys both services

> The first build takes 3–6 minutes. Watch the build logs in real time on each service's page.

---

## Step 2 — Wire FRONTEND_URL (backend → frontend)

After the first deploy completes:

1. Go to the **blog-frontend** service page and copy its URL, e.g. `https://blog-frontend.onrender.com`
2. Go to the **blog-backend** service → **Environment** tab
3. Add (or update) the variable:

   | Key | Value |
   |---|---|
   | `FRONTEND_URL` | `https://blog-frontend.onrender.com` |

4. Click **Save Changes** — the backend redeploys automatically with CORS now allowing your frontend origin.

---

## Step 3 — Verify NEXT_PUBLIC_API_URL

`render.yaml` already sets `NEXT_PUBLIC_API_URL` to `https://blog-backend.onrender.com`. Because the frontend uses Render's native Node.js build, this env var is available at build time and automatically baked into the Next.js client bundle.

**If you kept the default service name (`blog-backend`) this step requires nothing — skip to Step 4.**

If you renamed the backend service:

1. Go to the **blog-frontend** service → **Environment** tab
2. Update `NEXT_PUBLIC_API_URL` to match the actual backend URL
3. Click **Save Changes** — the frontend rebuilds automatically with the correct URL baked in

---

## Step 4 — Verify

Once both services show a green **Live** status, test the following URLs:

| Check | URL |
|---|---|
| Frontend home page | `https://blog-frontend-h0oo.onrender.com/` |
| Register a new account | `https://blog-frontend-h0oo.onrender.com/register` |
| Login | `https://blog-frontend-h0oo.onrender.com/login` |
| FastAPI interactive docs | `https://blog-backend-2xzu.onrender.com/docs` |
| API health check | `https://blog-backend-2xzu.onrender.com/api/v1/settings` |

---

## Redeploying after code changes

Render redeploys automatically when you push to the connected branch (`master`). To trigger a manual redeploy go to the service page → **Manual Deploy** → **Deploy latest commit**.

---

## Environment variable reference

### blog-backend

| Variable | Set by | Description |
|---|---|---|
| `DATABASE_URL` | `render.yaml` (auto from DB) | PostgreSQL connection string — injected automatically by Render |
| `SECRET` | `render.yaml` (auto-generated) | JWT signing secret — generated once at service creation |
| `FRONTEND_URL` | You (Step 2) | Full URL of the frontend service. Required for CORS. |

### blog-frontend

| Variable | Set by | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `render.yaml` | Full URL of the backend service. Available at build time (native Node.js env) and baked into the Next.js client bundle. |
| `NODE_ENV` | `render.yaml` | Set to `production`. |

---

## Caveats

- **Cold starts on free tier**: Render free services spin down after 15 minutes of inactivity. The first request after that takes 30–60 seconds. Upgrade to a paid plan to disable spin-down.
- **Free PostgreSQL expiry**: The free Render PostgreSQL database is deleted after 90 days. Export your data or upgrade to Starter before then.
- **Uploaded files**: Logo uploads are stored on the backend container's local disk and are lost on each redeploy. To persist them, configure an S3-compatible object store and update `backend/app/api/v1/admin.py`.
- **URL changes**: If you ever rename a service, remember to update `FRONTEND_URL` in the backend and `NEXT_PUBLIC_API_URL` in the frontend (with a rebuild).
