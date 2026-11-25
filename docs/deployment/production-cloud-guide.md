# Scribble-IT 2.0 — Production Cloud Deployment Guide

This guide covers deploying **Scribble-IT 2.0** (React SPA + FastAPI API + Background Worker + PostgreSQL 16 + Redis 7) to managed cloud environments (GCP Cloud Run / Cloud SQL / Memorystore, AWS ECS / RDS / ElastiCache, or Kubernetes).

## 1. Architecture Overview

- **Edge / TLS Proxy**: Cloud Load Balancer or Nginx reverse proxy terminating TLS 1.3 and forwarding `/api/*` to FastAPI while serving the compiled Vite SPA (`dist/`).
- **Stateless API Tier (`backend`)**: Horizontal autoscaling FastAPI instances (`uvicorn app.main:app --workers 4 --proxy-headers`). Uses strictly the restricted `scribble_app` PostgreSQL role (`NOSUPERUSER`, `NOBYPASSRLS`) so Row-Level Security (RLS) is enforced on every query.
- **Background Worker Tier (`worker`)**: Stateless async workers (`python -m app.workers.runner`) claiming durable jobs from PostgreSQL via `FOR UPDATE SKIP LOCKED`, delivering signed webhooks and external notifications with exponential backoff and dead-letter handling, and publishing heartbeats to Redis.
- **Database Tier (`postgres`)**: PostgreSQL 16+ with separated roles (`postgres_bootstrap`, `scribble_migrator` for Alembic DDL only, `scribble_app` for runtime).
- **Cache / Rate-Limit Tier (`redis`)**: Redis 7+ with persistence enabled (`appendonly yes`) for sliding-window API/AI rate limiting and worker heartbeats.

## 2. Mandatory Environment Secrets

Store all secrets in a managed secret store (Google Secret Manager, AWS Secrets Manager, or Vault). Never place secrets in `VITE_*` variables.

| Variable | Requirement |
| --- | --- |
| `APP_ENV` | `production` |
| `ENABLE_OPENAPI_DOCS` | `false` |
| `JWT_SECRET_KEY` | Random >= 32 bytes (e.g., `openssl rand -hex 32`) |
| `INTEGRATION_ENCRYPTION_KEY` | Random >= 32 bytes for Fernet credential encryption at rest |
| `DATABASE_URL` | `postgresql+asyncpg://scribble_app:<pass>@<host>:5432/scribble_it` |
| `MIGRATION_DATABASE_URL` | `postgresql+psycopg://scribble_migrator:<pass>@<host>:5432/scribble_it` |
| `REDIS_URL` | `redis://<host>:6379/0` (or `rediss://` with TLS) |
| `CORS_ALLOWED_ORIGINS` | Exact comma-separated frontend origins (no wildcards `*`) |
| `GEMINI_API_KEY` | Backend-only Gemini API key (`GEMINI_MODEL=gemini-4-hydrogen`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TELEPHONY_WEBHOOK_SECRET` | Optional server-side telephony credentials |

## 3. Database Initialization & Migrations

1. Provision PostgreSQL 16 and run `infrastructure/postgres/init-roles.sh` once using the bootstrap superuser credentials to create `scribble_migrator` and `scribble_app`.
2. Run database migrations as a one-off job using `MIGRATION_DATABASE_URL`:
   ```bash
   alembic upgrade head
   ```
3. Verify RLS enforcement:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
   ```

## 4. Controlled Firebase -> PostgreSQL Cutover Runbook

1. Export existing Firebase Auth users and Firestore workspace documents into a JSON snapshot (`firebase_export.json`).
2. Run dry-run validation and inspect the reconciliation report:
   ```bash
   python3 backend/scripts/migrate_firebase_to_postgres.py \
     --input firebase_export.json \
     --report-json reconciliation.json \
     --report-md reconciliation.md
   ```
3. Confirm all integrity checks report `[PASS]` (`all_tenant_scoped_records_have_valid_organization_id`, `zero_plaintext_passwords_in_output`).
4. Apply transactionally during a maintenance window:
   ```bash
   python3 backend/scripts/migrate_firebase_to_postgres.py \
     --input firebase_export.json \
     --apply \
     --database-url "$MIGRATION_DATABASE_URL" \
     --report-json reconciliation-applied.json \
     --report-md reconciliation-applied.md
   ```
5. Switch frontend build env to `VITE_USE_BACKEND_API=true` and `VITE_API_BASE_URL=https://api.your-domain.com`. Keep legacy Firebase files intact during the parallel verification window; remove only after 100% cutover sign-off.
6. Prompt migrated users to complete password reset so Argon2id hashes are freshly enrolled.

## 5. Observability, Health Probes & Backups

- **Liveness**: `GET /api/v1/health` (HTTP 200)
- **Readiness**: `GET /api/v1/health/ready` (verifies PostgreSQL non-superuser role + Redis; HTTP 503 if degraded)
- **Prometheus Metrics**: `GET /api/v1/metrics` (exposes `scribble_process_uptime_seconds`, `scribble_dependency_up`, `scribble_dependency_latency_ms`, `scribble_db_pool_connections`, `scribble_worker_heartbeat_age_seconds`). Restrict `/api/v1/metrics` to internal scrape networks at the load balancer.
- **Backups**: Enable automated PITR on Cloud SQL / RDS or schedule `infrastructure/postgres/backup.sh` daily and test restores regularly with `infrastructure/postgres/restore.sh`.
