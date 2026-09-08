#!/usr/bin/env bash
# Restore a dump into the LOCAL Supabase database. Never production.
#
#   npm run db:restore -- path/to/wows-YYYYMMDDTHHMMSSZ.dump
#
# Refuses any target that is not localhost/127.0.0.1. The local database must
# be running (`npm run db:start`). The `public` and `drizzle` schemas are
# dropped and recreated from the dump; privileges (the wows_app grants and
# the anon/authenticated revokes) come from the dump, so the role is created
# first if the instance is fresh.
set -euo pipefail

DUMP="${1:?usage: restore.sh <dump-file>}"
TARGET="${RESTORE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PG_IMAGE="postgres:17-alpine"

case "${TARGET}" in
  *@127.0.0.1:*|*@localhost:*) ;;
  *) echo "refusing to restore into ${TARGET}: only local targets are allowed" >&2; exit 1 ;;
esac
[ -s "${DUMP}" ] || { echo "dump file ${DUMP} is missing or empty" >&2; exit 1; }

# Inside the container 127.0.0.1 is the container itself; reach the host.
CONTAINER_TARGET="${TARGET/127.0.0.1/host.docker.internal}"
CONTAINER_TARGET="${CONTAINER_TARGET/localhost/host.docker.internal}"
run_psql() {
  docker run --rm -i --add-host=host.docker.internal:host-gateway -e PGURL="${CONTAINER_TARGET}" "${PG_IMAGE}" \
    sh -c 'psql -X -q -v ON_ERROR_STOP=1 "$PGURL"'
}

echo "preparing ${TARGET}"
run_psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wows_app') THEN
    CREATE ROLE wows_app NOLOGIN NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;
GRANT wows_app TO postgres;
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

echo "restoring ${DUMP}"
# A list file lets us skip entries that belong to Supabase, not to us: the
# public schema itself (its owner, comment and ACL are managed by Supabase)
# and supabase_admin's default privileges, which postgres cannot re-apply.
# Everything else restores verbatim, including our grants and policies.
docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -e PGURL="${CONTAINER_TARGET}" "${PG_IMAGE}" \
  sh -c 'cat > /tmp/restore.dump \
    && pg_restore -l /tmp/restore.dump \
       | grep -v " SCHEMA - public " \
       | grep -v " COMMENT - SCHEMA public " \
       | grep -v " ACL - SCHEMA public " \
       | grep -v "DEFAULT ACL .* supabase_admin$" > /tmp/restore.list \
    && pg_restore --no-owner --exit-on-error -L /tmp/restore.list --dbname="$PGURL" /tmp/restore.dump' \
  < "${DUMP}"
# The schema ACL entry was skipped above; the app role needs schema usage.
echo "GRANT USAGE ON SCHEMA public TO wows_app;" | run_psql
echo "restore complete"
