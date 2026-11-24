#!/usr/bin/env bash
set -euo pipefail

# Provisions strictly separated PostgreSQL roles on fresh database initialization:
# 1. POSTGRES_MIGRATOR_USER (default: scribble_migrator) — DDL schema owner for Alembic only
# 2. POSTGRES_APP_USER      (default: scribble_app)      — Restricted NOSUPERUSER / NOBYPASSRLS runtime role

MIGRATOR_USER="${POSTGRES_MIGRATOR_USER:-scribble_migrator}"
MIGRATOR_PASS="${POSTGRES_MIGRATOR_PASSWORD:?POSTGRES_MIGRATOR_PASSWORD must be set}"
APP_USER="${POSTGRES_APP_USER:-scribble_app}"
APP_PASS="${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD must be set}"
DB_NAME="${POSTGRES_DB:-scribble_it}"

psql -v ON_ERROR_STOP=1 \
  --username "${POSTGRES_USER}" \
  --dbname "${DB_NAME}" \
  -v migrator_user="${MIGRATOR_USER}" \
  -v migrator_pass="${MIGRATOR_PASS}" \
  -v app_user="${APP_USER}" \
  -v app_pass="${APP_PASS}" \
  -v db_name="${DB_NAME}" <<'EOSQL'
-- Enable pgcrypto at bootstrap so non-superuser migrator can rely on gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Dedicated Alembic migration role (non-superuser, owns public schema & tables)
SELECT format(
  'CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
  :'migrator_user', :'migrator_pass'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_user')
\gexec

-- 2. Restricted runtime application role (NOSUPERUSER + NOBYPASSRLS enforces PostgreSQL RLS)
SELECT format(
  'CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT',
  :'app_user', :'app_pass'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

-- Lock down default PUBLIC privileges
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Grant database connection rights
SELECT format('GRANT CONNECT ON DATABASE %I TO %I, %I', :'db_name', :'migrator_user', :'app_user') \gexec

-- Allow migrator to manage schemas and objects inside the application database
SELECT format('GRANT CREATE ON DATABASE %I TO %I', :'db_name', :'migrator_user') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'migrator_user') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user') \gexec

-- Default privileges for all future tables/sequences created by the migrator role:
-- runtime role gets DML only (SELECT, INSERT, UPDATE, DELETE) — NEVER DDL (ALTER/DROP/TRUNCATE).
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  :'migrator_user', :'app_user'
) \gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
  :'migrator_user', :'app_user'
) \gexec
EOSQL
