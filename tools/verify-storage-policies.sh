#!/usr/bin/env bash
# QC B3: proves the old "images" policies leak and the new ones isolate users.
# Needs a local, throwaway Postgres (PGHOST/PGPORT/PGUSER). Never point it at Supabase.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tools/verify-storage-policies.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=mylife_storage_qc
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/supabase_stub.sql >/dev/null

echo "== OLD policies (supabase/schema.sql as it was before B3)"
git show "${OLD_REF:-185287f}:supabase/schema.sql" | sed -n '/create policy "Public read access to images"/,$p' | run >/dev/null
run -f supabase/tests/storage_policies_test.sql | grep -E "FAIL|failures|^ +[0-9]+ \|" | tail -3
old_fail=$(run -tA -f supabase/tests/storage_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)

echo "== NEW policies (supabase/migrations/20261021_images_owner_only.sql)"
run -f supabase/migrations/20261021_images_owner_only.sql >/dev/null
run -f supabase/tests/storage_policies_test.sql
new_fail=$(run -tA -f supabase/tests/storage_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)

echo "old policies: $old_fail failing checks (expected > 0) | new policies: $new_fail failing checks (expected 0)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$old_fail" -gt 0 ] && [ "$new_fail" -eq 0 ]
