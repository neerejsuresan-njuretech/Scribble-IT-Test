# Scribble-IT 2.0 — Self-Hosted Enterprise Deployment Guide

This guide describes how to self-host **Scribble-IT 2.0** on your own Linux server or private cloud VM using Docker Compose.

## 1. Prerequisites

- Linux host (Ubuntu 22.04+ / Debian 12+ / RHEL 9+) with **4+ vCPU, 8 GB RAM, 50+ GB SSD**
- Docker Engine 24+ and Docker Compose v2 (`docker compose version`)
- Domain name pointing to your host + TLS terminator (Caddy, Traefik, or Certbot + Nginx)

## 2. Configure Environment

```bash
cp .env.example .env
```

Generate strong random secrets and set them in `.env`:

```bash
openssl rand -hex 32   # -> JWT_SECRET_KEY
openssl rand -hex 32   # -> INTEGRATION_ENCRYPTION_KEY
openssl rand -base64 24 # -> POSTGRES_SUPERUSER_PASSWORD
openssl rand -base64 24 # -> POSTGRES_MIGRATOR_PASSWORD
openssl rand -base64 24 # -> POSTGRES_APP_PASSWORD
```

Update `.env`:
- Set `APP_ENV="production"` and `ENABLE_OPENAPI_DOCS="false"`
- Set `CORS_ALLOWED_ORIGINS="https://itsm.your-company.com"`
- Set `VITE_USE_BACKEND_API="true"` and `VITE_API_BASE_URL="https://itsm.your-company.com"`
- Optionally set `GEMINI_API_KEY` (backend-only) and `TWILIO_*` variables

## 3. Launch Production Stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile web up -d --build
```

Services started:
1. `postgres` — PostgreSQL 16 (internal Docker network only; port 5432 not exposed publicly)
2. `redis` — Redis 7 with AOF persistence (internal only)
3. `migrator` — One-shot Alembic migration runner (`alembic upgrade head`)
4. `backend` — Multi-worker FastAPI server on internal port 8000 with `uploads_data` volume
5. `worker` — Dedicated async background worker for signed webhooks and external notifications
6. `web` — Hardened Nginx serving the React SPA + reverse-proxying `/api/` with rate limiting & CSP

## 4. Verify Health & Worker Status

```bash
curl -fsS http://127.0.0.1/healthz
curl -fsS http://127.0.0.1/api/v1/health/ready
curl -fsS http://127.0.0.1/api/v1/metrics | grep scribble_worker_heartbeat_age_seconds
```

## 5. Automated Backups & Verified Restore

Schedule daily backups via `cron`:

```bash
0 2 * * * docker compose exec -T postgres bash /backup/backup.sh
```

Or run manually from the host:

```bash
POSTGRES_HOST=127.0.0.1 POSTGRES_SUPERUSER_PASSWORD="..." bash infrastructure/postgres/backup.sh
```

To test or perform a full restore:

```bash
POSTGRES_HOST=127.0.0.1 POSTGRES_SUPERUSER_PASSWORD="..." bash infrastructure/postgres/restore.sh /var/backups/scribble-it/scribble_it_YYYYMMDDTHHMMSSZ.dump
```

## 6. Safe Upgrades

1. Take a fresh backup using `infrastructure/postgres/backup.sh`.
2. Pull the latest release tag (`git pull && git checkout <tag>`).
3. Rebuild and restart (`docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile web up -d --build`). The `migrator` container automatically runs `alembic upgrade head` before `backend` and `worker` start.
