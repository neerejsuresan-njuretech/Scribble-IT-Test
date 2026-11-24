# Scribble-IT 2.0 — Backend Foundation & Developer Setup Guide

This guide covers running, migrating, and testing the Scribble-IT 2.0 Python/FastAPI + PostgreSQL + Redis backend foundation alongside the preserved Scribble-IT 1.x React frontend.

---

## 1. Architecture Overview (Phase 1 Foundation)

- **API Framework**: FastAPI + Uvicorn (`backend/app/main.py`)
- **Configuration**: Strict Pydantic Settings (`backend/app/core/config.py`) with production guardrails (rejects PostgreSQL superusers on runtime `DATABASE_URL`, wildcard CORS, and weak JWT secrets).
- **Database**: PostgreSQL 16 + SQLAlchemy 2.x Async (`asyncpg`) + Alembic migrations (`psycopg`).
- **Role Separation**:
  - `scribble_migrator`: Used exclusively by Alembic (`MIGRATION_DATABASE_URL`) for DDL migrations.
  - `scribble_app`: Restricted runtime role (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`) used exclusively by FastAPI (`DATABASE_URL`).
- **Cache / Broker**: Redis 7 async connection pool (`backend/app/core/redis.py`).
- **Observability & Safety**: Structured JSON logging with sensitive-field redaction, `X-Request-ID` propagation, security response headers, request body size guard, and RFC-style centralized error envelopes.

---

## 2. Environment Configuration

Copy the environment template and set strong credentials:

```bash
cp .env.example .env
```

Key backend variables:
- `APP_ENV`: `development` | `staging` | `production` | `test`
- `POSTGRES_DB`, `POSTGRES_SUPERUSER`, `POSTGRES_SUPERUSER_PASSWORD` (used only by PostgreSQL container bootstrap)
- `POSTGRES_MIGRATOR_USER`, `POSTGRES_MIGRATOR_PASSWORD`
- `POSTGRES_APP_USER`, `POSTGRES_APP_PASSWORD`
- `DATABASE_URL`: `postgresql+asyncpg://<app_user>:<app_pass>@postgres:5432/scribble_it`
- `MIGRATION_DATABASE_URL`: `postgresql+psycopg://<migrator_user>:<migrator_pass>@postgres:5432/scribble_it`
- `REDIS_URL`: `redis://redis:6379/0`
- `JWT_SECRET_KEY`: Minimum 32-character high-entropy secret (required in staging/production)
- `CORS_ALLOWED_ORIGINS`: Comma-separated explicit origins (wildcards rejected in production)

---

## 3. Docker Compose Startup Instructions

Start PostgreSQL (with automated role separation via `infrastructure/postgres/init-roles.sql`), Redis, one-shot Alembic migrations, FastAPI backend, and React web frontend:

```bash
# Start full local development stack
docker compose up --build

# Start only infrastructure + backend API
docker compose up --build postgres redis migrator backend

# Start with optional Nginx reverse proxy profile
docker compose --profile proxy up --build
```

Verify endpoints once running:
- **Liveness**: `GET http://localhost:8000/api/v1/health`
- **Readiness (PostgreSQL + Redis)**: `GET http://localhost:8000/api/v1/health/ready`
- **Version**: `GET http://localhost:8000/api/v1/version`
- **Swagger / OpenAPI**: `http://localhost:8000/api/docs`
- **OpenAPI JSON**: `http://localhost:8000/api/openapi.json`

---

## 4. Database Migration Commands (Alembic)

Migrations always run under `MIGRATION_DATABASE_URL` (`scribble_migrator`), never the runtime `scribble_app` role.

```bash
# Via Docker Compose
docker compose run --rm migrator

# Apply all pending migrations locally
cd backend
alembic upgrade head

# Check current migration revision
alembic current

# Roll back one revision (verifies downgrade safety)
alembic downgrade -1

# Full rollback + re-apply verification
alembic downgrade base && alembic upgrade head

# Generate offline SQL script for change-board review
alembic upgrade head --sql

# Create a new migration after modifying SQLAlchemy models
alembic revision --autogenerate -m "describe_change"
```

---

## 5. Running Automated Tests

### Local Python virtual environment
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -v
```

### Inside Docker (with live PostgreSQL & Redis)
```bash
docker compose up -d postgres redis migrator
docker compose run --rm backend pytest -v
```

### Live Integration Tests
When `RUN_LIVE_INTEGRATION_TESTS=true` (automatically set in GitHub Actions CI and Docker Compose test runs), the suite executes:
- Live PostgreSQL connectivity and verification that the runtime DB user is **not** a PostgreSQL superuser (`rolsuper = false`, `rolbypassrls = false`).
- Live Redis `PING` and read/write round-trip checks.
- Full Alembic `upgrade head` -> `downgrade base` -> `upgrade head` lifecycle verification.
