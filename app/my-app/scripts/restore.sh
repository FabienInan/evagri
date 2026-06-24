#!/bin/sh
set -e

BACKUP_FILE=$1
TMP_FILE="/tmp/restore.sql.gz"

aws s3 cp "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" "$TMP_FILE" --endpoint-url="${S3_ENDPOINT}"
gunzip < "$TMP_FILE" | psql "$DATABASE_URL"
rm "$TMP_FILE"
echo "Restore completed from ${BACKUP_FILE}"
