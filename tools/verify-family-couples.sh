#!/usr/bin/env bash
# Shared couple date (supabase/migrations/20261111_family_couples.sql). Local throwaway Postgres only.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tools/verify-family-couples.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=mylife_couples_qc
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/supabase_stub.sql >/dev/null
run -c "create table if not exists auth.users (id uuid primary key); grant select on auth.users to authenticated;" >/dev/null
run -f supabase/migrations/20261023_family_core.sql >/dev/null
run -f supabase/migrations/20261111_family_couples.sql >/dev/null
run -f supabase/migrations/20261111_family_couples.sql >/dev/null   # running twice is safe
out=$(run -tA -f supabase/tests/family_couples_test.sql); echo "$out"
fails=$(echo "$out" | tail -1 | cut -d'|' -f1)
run -f supabase/migrations/20261111_family_couples_rollback.sql >/dev/null
left=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name='family_couples'")
fam=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('families','family_members')")
echo "failing checks: $fails (expected 0) | couples table after rollback: $left (expected 0) | family tables kept: $fam (expected 2)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$fails" -eq 0 ] && [ "$left" -eq 0 ] && [ "$fam" -eq 2 ]
