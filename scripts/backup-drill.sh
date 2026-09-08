#!/usr/bin/env bash
# The restore drill (H35: "documented, TESTED restore procedure").
#
# Dumps the local seeded database with the same pg_dump command production
# uses, restores it with scripts/restore.sh (which wipes the schemas first),
# and checks that row counts match and the app role still has access.
# Runs in CI on every push; a human runs it monthly against the latest
# production dump (README > Backups).
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PG_IMAGE="postgres:17-alpine"
CONTAINER_URL="${DB_URL/127.0.0.1/host.docker.internal}"
CONTAINER_URL="${CONTAINER_URL/localhost/host.docker.internal}"
WORK="$(mktemp -d)"
DUMP="${WORK}/drill.dump"

psql_in_container() {
  docker run --rm -i --add-host=host.docker.internal:host-gateway -e PGURL="${CONTAINER_URL}" "${PG_IMAGE}" \
    sh -c 'psql -X -q -v ON_ERROR_STOP=1 -tA "$PGURL"'
}

COUNT_SQL="SELECT (SELECT count(*) FROM users) || ',' || (SELECT count(*) FROM forecasts) || ',' || (SELECT count(*) FROM research_notes) || ',' || (SELECT count(*) FROM audit_log) || ',' || (SELECT count(*) FROM pg_policies) || ',' || (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal);"

BEFORE=$(echo "${COUNT_SQL}" | psql_in_container)
echo "before: users,forecasts,notes,audit,policies,triggers = ${BEFORE}"

echo "dumping"
docker run --rm --add-host=host.docker.internal:host-gateway -e PGURL="${CONTAINER_URL}" "${PG_IMAGE}" \
  sh -c 'pg_dump --format=custom --no-owner --schema=public --schema=drizzle "$PGURL"' > "${DUMP}"
echo "dump size: $(wc -c < "${DUMP}") bytes"

RESTORE_DB_URL="${DB_URL}" "$(dirname "$0")/restore.sh" "${DUMP}"

AFTER=$(echo "${COUNT_SQL}" | psql_in_container)
echo "after:  users,forecasts,notes,audit,policies,triggers = ${AFTER}"

# The app role must still be able to read through RLS after a restore.
ANY_USER=$(echo "SELECT id FROM users ORDER BY created_at LIMIT 1;" | psql_in_container)
APP_OK=$(printf "BEGIN; SET LOCAL ROLE wows_app; SELECT set_config('app.user_id', '%s', true); SELECT count(*) FROM users; COMMIT;" "${ANY_USER}" | psql_in_container | tail -1)
echo "rows visible to wows_app after restore: ${APP_OK}"
rm -rf "${WORK}"

if [ "${BEFORE}" != "${AFTER}" ]; then
  echo "RESTORE DRILL FAILED: counts differ" >&2
  exit 1
fi
if [ "${APP_OK}" = "0" ] || [ -z "${APP_OK}" ]; then
  echo "RESTORE DRILL FAILED: wows_app cannot read after restore (privileges missing)" >&2
  exit 1
fi
echo "restore drill passed"
