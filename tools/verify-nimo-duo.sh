#!/usr/bin/env bash
# Nimo shared streak (supabase/migrations/20261111_nimo_duo.sql). Local throwaway Postgres only.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tools/verify-nimo-duo.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=mylife_duo_qc
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/supabase_stub.sql >/dev/null
run -c "create table if not exists auth.users (id uuid primary key); grant select on auth.users to authenticated;" >/dev/null
run -f supabase/schema.sql >/dev/null 2>&1 || true
run -f supabase/migrations/20261023_family_core.sql >/dev/null
run -f supabase/migrations/20261105_nimo_core.sql >/dev/null
run -f supabase/migrations/20261111_nimo_duo.sql >/dev/null
run -f supabase/migrations/20261111_nimo_duo.sql >/dev/null   # twice is safe
out=$(run -tA -f supabase/tests/nimo_duo_test.sql 2>&1 | grep -v '^\[' ); echo "$out" | tail -16
fails=$(echo "$out" | tail -1 | cut -d'|' -f1)
run -f supabase/migrations/20261111_nimo_duo_rollback.sql >/dev/null
left=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name='nimo_duos'")
echo "failing checks: $fails (expected 0) | duo table after rollback: $left (expected 0)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$fails" = "0" ] && [ "$left" -eq 0 ]
