#!/usr/bin/env bash
# Daily backup: pg_dump the production database and upload it to a private
# Supabase Storage bucket, then prune dumps older than RETENTION_DAYS.
#
# Runs in GitHub Actions (.github/workflows/backup.yml). pg_dump runs inside
# the postgres:17 container so its version always matches the server.
#
# Required environment:
#   SUPABASE_DB_URL             session-mode connection string (pg_dump cannot
#                               use transaction mode)
#   SUPABASE_URL                https://<ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY   for the Storage API
# Optional:
#   BACKUP_BUCKET (default db-backups), RETENTION_DAYS (default 30)
set -euo pipefail

BUCKET="${BACKUP_BUCKET:-db-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="wows-${STAMP}.dump"
PG_IMAGE="postgres:17-alpine"

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"

echo "dumping to ${FILE}"
docker run --rm -e PGURL="${SUPABASE_DB_URL}" "${PG_IMAGE}" \
  sh -c 'pg_dump --format=custom --no-owner --schema=public --schema=drizzle "$PGURL"' \
  > "${FILE}"
SIZE=$(wc -c < "${FILE}")
if [ "${SIZE}" -lt 1024 ]; then
  echo "dump is suspiciously small (${SIZE} bytes); aborting" >&2
  exit 1
fi
echo "dump size: ${SIZE} bytes"

echo "uploading to ${BUCKET}/${FILE}"
curl --fail --silent --show-error -X POST \
  "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${FILE}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"${FILE}" > /dev/null
echo "uploaded"

echo "pruning dumps older than ${RETENTION_DAYS} days"
CUTOFF=$(date -u -d "-${RETENTION_DAYS} days" +%Y%m%dT%H%M%SZ 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%Y%m%dT%H%M%SZ)
LIST=$(curl --fail --silent --show-error -X POST \
  "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"","limit":1000,"sortBy":{"column":"name","order":"asc"}}')
OLD=$(echo "${LIST}" | python3 -c '
import sys, json
cutoff = sys.argv[1]
for o in json.load(sys.stdin):
    name = o.get("name", "")
    if name.startswith("wows-") and name.endswith(".dump") and name[5:21] < cutoff:
        print(name)
' "${CUTOFF}")
if [ -n "${OLD}" ]; then
  PREFIXES=$(echo "${OLD}" | python3 -c 'import sys, json; print(json.dumps({"prefixes": [l.strip() for l in sys.stdin if l.strip()]}))')
  curl --fail --silent --show-error -X DELETE \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "${PREFIXES}" > /dev/null
  echo "pruned:"; echo "${OLD}"
else
  echo "nothing to prune"
fi
rm -f "${FILE}"
echo "backup complete"
