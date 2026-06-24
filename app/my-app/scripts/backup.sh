#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/tmp/evagri_${TIMESTAMP}.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$DUMP_FILE"

aws s3 cp "$DUMP_FILE" "s3://${S3_BUCKET}/backups/" --endpoint-url="${S3_ENDPOINT}"

rm "$DUMP_FILE"
echo "Backup completed: backups/evagri_${TIMESTAMP}.sql.gz"
