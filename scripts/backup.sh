#!/usr/bin/env bash

set -euo pipefail

# Backup script for rbhargava-invoice-generator
# - Creates a consistent SQLite backup using sqlite3 ".backup"
# - Archives uploads folder
# - Prunes old backups (default: keep 30 days)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DB_PATH="${PROJECT_ROOT}/invoices.db"
UPLOADS_PATH="${PROJECT_ROOT}/server/uploads"

BACKUP_BASE_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +'%Y%m%d-%H%M%S')"
BACKUP_DIR="${BACKUP_BASE_DIR}/${TIMESTAMP}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "Error: sqlite3 command is required but not found."
  exit 1
fi

if [[ ! -f "${DB_PATH}" ]]; then
  echo "Error: database file not found at ${DB_PATH}"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "Creating database backup..."
sqlite3 "${DB_PATH}" ".backup '${BACKUP_DIR}/invoices.db'"

echo "Compressing database backup..."
gzip -f "${BACKUP_DIR}/invoices.db"

if [[ -d "${UPLOADS_PATH}" ]]; then
  echo "Archiving uploads..."
  tar -czf "${BACKUP_DIR}/uploads.tar.gz" -C "${PROJECT_ROOT}/server" "uploads"
fi

cat > "${BACKUP_DIR}/metadata.txt" <<EOF
created_at=$(date -Iseconds)
project_root=${PROJECT_ROOT}
db_file=invoices.db.gz
uploads_archive=$( [[ -f "${BACKUP_DIR}/uploads.tar.gz" ]] && echo "uploads.tar.gz" || echo "none" )
EOF

echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_BASE_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +

echo "Backup completed: ${BACKUP_DIR}"
