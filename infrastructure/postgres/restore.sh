#!/usr/bin/env bash
# Scribble-IT 2.0 PostgreSQL Verified Restore Script
# Usage: ./infrastructure/postgres/restore.sh /path/to/scribble_it_20261125T000000Z.dump
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.dump>" >&2
  exit 2
fi

DUMP_FILE="$1"
if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "ERROR: Dump file not found: ${DUMP_FILE}" >&2
  exit 2
fi

if [[ -f "${DUMP_FILE}.sha256" ]]; then
  echo "[restore] Verifying SHA-256 checksum..."
  sha256sum --check "${DUMP_FILE}.sha256"
fi

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-scribble_it}"
POSTGRES_USER="${POSTGRES_SUPERUSER:-postgres_bootstrap}"

echo "[restore] Restoring ${DUMP_FILE} into ${POSTGRES_DB} on ${POSTGRES_HOST}:${POSTGRES_PORT}..."
pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --clean \
  --if-exists \
  --no-owner \
  --single-transaction \
  "${DUMP_FILE}"

echo "[restore] Verifying restored table counts and RLS status..."
psql \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  -c "SELECT count(*) AS organizations FROM organizations; SELECT count(*) AS incidents FROM incidents; SELECT count(*) AS rls_tables FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity=true;"

echo "[restore] Restore completed and verified."
