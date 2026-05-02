# Render Deployment Guide — Blueprint (Three Services)

This project deploys to Render as three separate services defined in [`render.yaml`](render.yaml):

| Service | Type | What it runs |
|---|---|---|
| `blog-db` | Managed PostgreSQL | Render-managed database |
| `blog-backend` | Web Service (Docker) | FastAPI on port 8000 |
| `blog-frontend` | Web Service (Node.js) | Next.js standalone server |

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

> **Note on service URLs**: Render appends a random suffix to service names if the plain name is already taken on the platform (e.g. `blog-backend-2xzu.onrender.com`). Note your actual URLs from each service's page — you will need them in the steps below.

---

## Step 2 — Wire the backend and frontend URLs

After the first deploy completes, both services need to know each other's URL.

### 2a — Set FRONTEND_URL on the backend (required for CORS)

1. Go to the **blog-frontend** service page and copy its URL (e.g. `https://blog-frontend-xxxx.onrender.com`)
2. Go to the **blog-backend** service → **Environment** tab
3. Add the variable:

   | Key | Value |
   |---|---|
   | `FRONTEND_URL` | `https://blog-frontend-xxxx.onrender.com` |

4. Click **Save Changes** — the backend redeploys with CORS allowing your frontend origin

### 2b — Set NEXT_PUBLIC_API_URL on the frontend (baked into the bundle at build time)

1. Go to the **blog-backend** service page and copy its URL (e.g. `https://blog-backend-xxxx.onrender.com`)
2. Go to the **blog-frontend** service → **Environment** tab
3. Update the variable:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://blog-backend-xxxx.onrender.com` |

4. Click **Save Changes** — the frontend rebuilds with the correct backend URL baked into the Next.js bundle

> `NEXT_PUBLIC_API_URL` is a build-time variable. Any change requires a full frontend rebuild to take effect — Render triggers this automatically when you save.

---

## Step 3 — Create the first admin user

There is no admin account by default. Because Render's Shell is a paid feature, the easiest approach is to connect to the managed database directly using a GUI tool such as [TablePlus](https://tableplus.com) (free tier is sufficient).

### 3a — Register an account

Go to `https://blog-frontend-xxxx.onrender.com/register` and create an account with the email address you want to use as admin. This ensures the password is correctly hashed by the application.

### 3b — Get the database connection string

1. In the Render dashboard go to the **blog-db** service → **Info** tab
2. Under **Connections**, copy the **External Connection String**
   (format: `postgresql://blog_user:PASSWORD@HOST/blog_db`)

### 3c — Connect with TablePlus

1. Open TablePlus → **New Connection** → **PostgreSQL**
2. Paste the connection string into the URL field, or fill in the individual fields (host, port, user, password, database) from the connection details
3. Enable **SSL** (Render requires it)
4. Click **Connect**

### 3d — Promote the account to admin

Open a new query (`Cmd+T` / `Ctrl+T`) and run:

```sql
UPDATE users
SET is_superuser = true,
    is_active    = true,
    role         = 'admin'
WHERE email = 'your@email.com';
```

Click **Commit** (`Cmd+S` / `Ctrl+S`) to save the change — TablePlus does not auto-commit.

### 3e — Log in

Go to `https://blog-frontend-xxxx.onrender.com/login` and sign in. You will now have access to the `/admin` panel.

---

## Step 4 — Verify

Once both services show a green **Live** status:

| Check | URL |
|---|---|
| Frontend home page | `https://blog-frontend-xxxx.onrender.com/` |
| Register a new account | `https://blog-frontend-xxxx.onrender.com/register` |
| Login | `https://blog-frontend-xxxx.onrender.com/login` |
| Admin panel | `https://blog-frontend-xxxx.onrender.com/admin` |
| FastAPI interactive docs | `https://blog-backend-xxxx.onrender.com/docs` |
| API health check | `https://blog-backend-xxxx.onrender.com/api/v1/settings` |

Replace `blog-frontend-xxxx` / `blog-backend-xxxx` with your actual service URLs.

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
| `FRONTEND_URL` | You (Step 2a) | Full URL of the frontend service. Required for CORS. |

### blog-frontend

| Variable | Set by | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | You (Step 2b) | Full URL of the backend service. Baked into the Next.js bundle at build time. |
| `NODE_ENV` | `render.yaml` | Set to `production`. |
| `HOSTNAME` | `render.yaml` | Set to `0.0.0.0` so the standalone server binds to all interfaces. |

---

## Caveats

- **Cold starts on free tier**: Render free services spin down after 15 minutes of inactivity. The first request after that takes 30–60 seconds. Upgrade to a paid plan to disable spin-down.
- **Free PostgreSQL expiry**: The free Render PostgreSQL database is deleted after 90 days. Export your data or upgrade to Starter before then.
- **Uploaded files**: Logo uploads are stored on the backend container's local disk and are lost on each redeploy. To persist them, configure an S3-compatible object store and update `backend/app/api/v1/admin.py`.
- **URL suffix**: Render appends a random slug to service names when the plain name is taken. If your URLs differ from the defaults, update `NEXT_PUBLIC_API_URL` in the frontend environment and `FRONTEND_URL` in the backend environment accordingly.
- **Render Shell is paid**: Direct shell access to the backend container requires a paid plan. Use a database GUI (TablePlus, DBeaver, pgAdmin) with the external connection string for any direct DB operations.
