#!/usr/bin/env bash
# Part 2A: family tables + RLS (supabase/migrations/20261023_family_core.sql).
# Needs a local, throwaway Postgres (PGHOST/PGPORT/PGUSER). Never point it at Supabase.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tools/verify-family-core.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=mylife_family_qc
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/supabase_stub.sql >/dev/null
run -c "create table if not exists auth.users (id uuid primary key); grant select on auth.users to authenticated;" >/dev/null
run -f supabase/migrations/20261023_family_core.sql >/dev/null
run -f supabase/migrations/20261023_family_core.sql >/dev/null   # running twice is safe
run -f supabase/tests/family_core_policies_test.sql
fails=$(run -tA -f supabase/tests/family_core_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
run -f supabase/migrations/20261023_family_core_rollback.sql >/dev/null
left=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'famil%'")
echo "failing checks: $fails (expected 0) | tables left after rollback: $left (expected 0)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$fails" -eq 0 ] && [ "$left" -eq 0 ]
