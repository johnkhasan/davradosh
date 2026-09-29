#!/usr/bin/env bash
# Daily backup of the database and uploaded images. Keeps 14 days.
# crontab -e →  0 3 * * * /srv/puzzle/backup.sh >> /var/log/puzzle-backup.log 2>&1
set -euo pipefail

cd /srv/puzzle
BACKUP_DIR=/var/backups/puzzle
STAMP=$(date +%F)
mkdir -p "$BACKUP_DIR"

# shellcheck disable=SC1091
source .env
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
tar czf "$BACKUP_DIR/uploads-$STAMP.tgz" -C /srv/puzzle uploads

find "$BACKUP_DIR" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: $(du -sh "$BACKUP_DIR" | cut -f1)"
