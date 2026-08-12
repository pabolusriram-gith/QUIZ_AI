#!/bin/bash
# QuizVerse AI Database Backup Script
# Designed to run inside or outside the postgres container.

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-quizverse_db}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

echo "[*] Starting database backup for database '${DB_NAME}'..."
mkdir -p "${BACKUP_DIR}"

# Run pg_dump and compress
if [ -n "${PGPASSWORD}" ] || [ -f ~/.pgpass ] || [ "${DB_HOST}" = "localhost" ]; then
    pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F p "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
    # Fallback to local socket dump if run directly inside the container without password check
    pg_dump -U "${DB_USER}" -F p "${DB_NAME}" | gzip > "${BACKUP_FILE}"
fi

echo "[+] Backup successfully created: ${BACKUP_FILE}"

# Print details
SIZE_BYTES=$(wc -c < "${BACKUP_FILE}")
echo "[*] Backup size: $((SIZE_BYTES / 1024)) KB"

# Purge old backups
echo "[*] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm {} \; -exec echo "[-] Deleted old backup: {}" \;

echo "[+] Backup operations complete."
