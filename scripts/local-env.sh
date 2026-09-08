#!/usr/bin/env bash
# Creates .env.local from .env.example (if absent) and fills in the keys of
# the running local Supabase instance. Requires `npm run db:start`.
set -euo pipefail
[ -f .env.local ] || cp .env.example .env.local
STATUS=$(npx supabase status -o env 2>/dev/null)
PUB=$(echo "${STATUS}" | sed -n 's/^PUBLISHABLE_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
SEC=$(echo "${STATUS}" | sed -n 's/^SECRET_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')
[ -n "${SEC}" ] || { echo "could not read keys: is the local instance running (npm run db:start)?" >&2; exit 1; }
sed -i.bak "s|^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.*|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${PUB}|; s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=${SEC}|" .env.local
rm -f .env.local.bak
echo ".env.local ready"
