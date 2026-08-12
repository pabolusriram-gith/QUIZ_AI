#!/bin/bash
# QuizVerse AI Database Restore Script
# Restores a database schema and data from a .sql.gz backup file.

set -e

# Configuration
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-quizverse_db}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

BACKUP_FILE="$1"
FORCE_RESTORE="$2"

if [ -z "${BACKUP_FILE}" ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz> [--force]"
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "[-] Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

if [ "${FORCE_RESTORE}" != "--force" ]; then
    echo "=========================================================="
    echo "WARNING: YOU ARE ABOUT TO RESTORE DATABASE: ${DB_NAME}"
    echo "THIS WILL OVERWRITE CURRENT DATA!"
    echo "=========================================================="
    read -p "Are you sure you want to proceed? (y/N): " confirm
    if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
        echo "[-] Restore cancelled."
        exit 0
    fi
fi

echo "[*] Restoring database '${DB_NAME}' from ${BACKUP_FILE}..."

# Create temporary uncompressed file
TEMP_SQL="/tmp/${DB_NAME}_restore_temp.sql"
gunzip -c "${BACKUP_FILE}" > "${TEMP_SQL}"

# Drop connections, recreate DB and restore
echo "[*] Re-initializing database schema..."
if [ -n "${PGPASSWORD}" ] || [ -f ~/.pgpass ] || [ "${DB_HOST}" = "localhost" ]; then
    # Terminate other connections to target DB
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${DB_NAME}' AND pid <> pg_backend_pid();" || true
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
    
    # Restore from sql
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${TEMP_SQL}"
else
    # Inside docker fallback
    psql -U "${DB_USER}" -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${DB_NAME}' AND pid <> pg_backend_pid();" || true
    psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
    
    psql -U "${DB_USER}" -d "${DB_NAME}" -f "${TEMP_SQL}"
fi

# Clean up temp files
rm -f "${TEMP_SQL}"

echo "[+] Database restore completed successfully."
