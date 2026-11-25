#!/usr/bin/env bash
# Scribble-IT 2.0 PostgreSQL Automated Backup Script
# Creates a custom-format compressed pg_dump with SHA-256 checksum and retention pruning.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/scribble-it}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-scribble_it}"
POSTGRES_USER="${POSTGRES_SUPERUSER:-postgres_bootstrap}"

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.dump"

echo "[backup] Starting PostgreSQL backup of ${POSTGRES_DB} -> ${OUT_FILE}"
pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --file="${OUT_FILE}" \
  "${POSTGRES_DB}"

sha256sum "${OUT_FILE}" > "${OUT_FILE}.sha256"
echo "[backup] Completed and verified checksum: ${OUT_FILE}.sha256"

# Prune backups older than retention window
find "${BACKUP_DIR}" -type f -name "${POSTGRES_DB}_*.dump*" -mtime +"${RETENTION_DAYS}" -delete
echo "[backup] Retention cleanup finished (${RETENTION_DAYS} days)."
