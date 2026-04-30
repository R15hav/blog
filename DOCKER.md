# Docker & Cloud Deployment Guide

This guide covers running the blog with Docker Compose — both for local testing and cloud deployment.

For running without Docker, see the [local development guide](README.md).

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Docker Compose network                              │
│                                                      │
│  ┌───────────┐    ┌───────────┐    ┌─────────────┐  │
│  │  frontend │───▶│  backend  │───▶│     db      │  │
│  │  :3000    │    │  :8000    │    │  postgres   │  │
│  └───────────┘    └───────────┘    │  :5432      │  │
│                                    └─────────────┘  │
└──────────────────────────────────────────────────────┘
        ▲                  ▲
   host:3000          host:8000
  (browser)          (API / docs)
```

The frontend build bakes `NEXT_PUBLIC_API_URL` at compile time (Next.js limitation for client-side env vars). All three services communicate on Docker's internal network using service names as hostnames.

---

## Quick Start (Local Docker)

### 1. Create the environment file

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` — the defaults work for local Docker use, but set a real `SECRET`:

```bash
# Generate a secure secret
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Paste the output as the value of `SECRET` in `backend/.env`.

### 2. Build and start

```bash
docker compose up --build
```

On first run this builds all three images. Subsequent runs reuse the cache and start in seconds.

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000      |
| Backend  | http://localhost:8000      |
| API docs | http://localhost:8000/docs |

### 3. Stop

```bash
docker compose down
```

To also remove the PostgreSQL volume (wipes all data):

```bash
docker compose down -v
```

---

## Build Context and `.dockerignore`

The biggest cause of slow Docker builds is transferring large directories (like `node_modules`) into the build context. Both services now have `.dockerignore` files to prevent this:

| Path                      | What it excludes                                      |
|---------------------------|-------------------------------------------------------|
| `frontend/.dockerignore`  | `node_modules`, `.next`, `.env*.local`                |
| `backend/.dockerignore`   | `__pycache__`, `.venv`, `*.db`, `tests/`, `.env`      |

Without these, the frontend build context was **over 1 GB** (the full `node_modules` folder). With them, it transfers only the source files — typically under 5 MB.

---

## Environment Variables Reference

All variables are read from `backend/.env` (loaded by `env_file` in `docker-compose.yml`). The compose file also injects `DATABASE_URL` automatically from the Postgres credentials, so you don't need to set it manually for local Docker use.

| Variable            | Default                  | Description                                           |
|---------------------|--------------------------|-------------------------------------------------------|
| `SECRET`            | `dev-secret-change-me`   | JWT signing secret — **must be changed in production**|
| `DATABASE_URL`      | auto-built from Postgres vars | PostgreSQL async connection string             |
| `FRONTEND_URL`      | `http://localhost:3000`  | Backend CORS allowed origin                           |
| `POSTGRES_USER`     | `blog_user`              | PostgreSQL username                                   |
| `POSTGRES_PASSWORD` | `blog_pass`              | PostgreSQL password                                   |
| `POSTGRES_DB`       | `blog_db`                | PostgreSQL database name                              |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL baked into the frontend at build time    |

---

## Cloud Deployment

### Key differences from local Docker

| Concern                  | Local                          | Cloud                                              |
|--------------------------|--------------------------------|----------------------------------------------------|
| Backend URL              | `http://localhost:8000`        | `https://api.yourdomain.com`                       |
| `NEXT_PUBLIC_API_URL`    | `http://localhost:8000`        | `https://api.yourdomain.com` (set at **build** time)|
| Database                 | Compose `db` service           | Managed PostgreSQL (RDS, Cloud SQL, Neon, Supabase) |
| Secret storage           | `backend/.env` file            | Provider secret manager (Secrets Manager, Vault)   |
| TLS                      | None                           | Reverse proxy (Nginx, Traefik, Caddy, load balancer)|

### Step-by-step

#### 1. Provision a managed PostgreSQL database

Use a managed service rather than running your own Postgres container in production — it handles backups, failover, and patching:

- **AWS**: RDS for PostgreSQL
- **GCP**: Cloud SQL for PostgreSQL
- **Railway / Render / Supabase / Neon**: simple hosted Postgres

Note the connection string in the format:

```
postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME
```

#### 2. Set production environment variables

Never use `.env` files in production. Use your cloud provider's secret/env management:

- **Railway / Render**: environment variable settings in the dashboard
- **AWS ECS / Fargate**: ECS task definition environment or AWS Secrets Manager
- **GCP Cloud Run**: Secret Manager + Cloud Run env vars
- **Kubernetes**: ConfigMaps + Secrets

Required variables for each service:

**Backend:**
```
SECRET=<strong-random-hex>
DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST:5432/DB
FRONTEND_URL=https://yourdomain.com
```

**Frontend (build arg — must be set at image build time):**
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

#### 3. Build the frontend image for your cloud URL

Because `NEXT_PUBLIC_API_URL` is baked in at compile time, build the frontend image with the correct URL:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  -t yourrepo/blog-frontend:latest \
  ./frontend
```

Push to your container registry:

```bash
docker push yourrepo/blog-frontend:latest
```

Do the same for the backend:

```bash
docker build -t yourrepo/blog-backend:latest ./backend
docker push yourrepo/blog-backend:latest
```

#### 4. Database migrations

The backend Dockerfile runs `alembic upgrade head` automatically before starting:

```dockerfile
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.app:app --host 0.0.0.0 --port 8000"]
```

This means migrations run on each container start. This is safe for rolling deployments as long as migrations are backwards-compatible (add columns with defaults, never drop columns until the old code is retired).

#### 5. TLS / HTTPS

Neither the backend nor the frontend container terminates TLS. Put a reverse proxy in front:

- **Nginx / Caddy**: on the same host or as a separate container
- **Cloud Load Balancer**: AWS ALB, GCP HTTPS Load Balancer
- **Traefik**: automatic cert management with Let's Encrypt

```
Browser → HTTPS → Load Balancer / Reverse Proxy → HTTP → Container
```

---

## Deploying with a Single compose Override (VPS / self-hosted)

For deploying on a single VPS (DigitalOcean Droplet, Hetzner, etc.), use a production override file alongside the base `docker-compose.yml`:

Create `docker-compose.prod.yml`:

```yaml
services:
  db:
    # Use a named volume with explicit driver for clarity
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    image: yourrepo/blog-backend:latest   # pull pre-built image
    environment:
      DATABASE_URL: postgresql+asyncpg://blog_user:${POSTGRES_PASSWORD}@db:5432/blog_db
      FRONTEND_URL: https://yourdomain.com
      SECRET: ${SECRET}

  frontend:
    image: yourrepo/blog-frontend:latest   # pre-built with correct NEXT_PUBLIC_API_URL
```

Deploy with:

```bash
# On the VPS
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Rebuilding After Code Changes

```bash
# Rebuild a single service
docker compose build backend
docker compose build frontend

# Rebuild and restart
docker compose up --build -d
```

The `.dockerignore` files ensure only changed source files trigger cache invalidation — dependency layers (`npm ci`, `uv sync`) are cached and only rebuilt when `package-lock.json` or `uv.lock` change.

---

## Troubleshooting

### Frontend can't reach the backend

`NEXT_PUBLIC_API_URL` is baked into the frontend bundle at **build time**, not runtime. If you see API calls going to the wrong URL, you need to **rebuild** the frontend image with the correct `--build-arg`.

### Migrations fail on startup

Check backend logs:

```bash
docker compose logs backend
```

Common cause: the database isn't ready yet. The `depends_on: condition: service_healthy` in `docker-compose.yml` waits for Postgres to accept connections, but if you're deploying to a managed database the connection details may be wrong. Verify `DATABASE_URL` is set correctly.

### Backend container exits immediately

```bash
docker compose logs backend --tail 50
```

Usually a missing environment variable (`SECRET`, `DATABASE_URL`) or a failed migration.

### Port already in use

```bash
# Find what's using the port
lsof -i :8000
lsof -i :3000

# Or change the host port in docker-compose.yml
ports:
  - "8001:8000"   # host:container
```
