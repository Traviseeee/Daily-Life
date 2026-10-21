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
[ "$old_fail" -gt 0 ] && [ "$new_fail" -eq 0 ] || { echo "repo-named check failed"; exit 1; }

# Live project names (seen 2026-10-21). Their conditions are not known yet, so the
# widest likely version is used: the migration must remove all four anyway.
echo "== LIVE-named old policies -> migration"
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run -f supabase/tests/supabase_stub.sql >/dev/null
run >/dev/null <<'SQL'
create policy "Public can view images" on storage.objects for select to public using (bucket_id = 'images');
create policy "Authenticated users can upload images" on storage.objects for insert to authenticated with check (bucket_id = 'images');
create policy "Authenticated users can update images" on storage.objects for update to authenticated using (bucket_id = 'images');
create policy "Authenticated users can delete images" on storage.objects for delete to authenticated using (bucket_id = 'images');
SQL
live_old=$(run -tA -f supabase/tests/storage_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
run -f supabase/migrations/20261021_images_owner_only.sql >/dev/null
live_new=$(run -tA -f supabase/tests/storage_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
echo "live-named: before $live_old failing (expected > 0) | after $live_new failing (expected 0)"

echo "== unknown extra policy -> migration must stop and change nothing"
run -c "create policy \"someone else's rule\" on storage.objects for select to public using (true)" >/dev/null
run -c "drop policy \"images: owner reads own folder\" on storage.objects" >/dev/null
before=$(run -tA -c "select string_agg(policyname, ',' order by policyname) from pg_policies where tablename='objects'")
if run -f supabase/migrations/20261021_images_owner_only.sql >/dev/null 2>&1; then stopped=no; else stopped=yes; fi
after=$(run -tA -c "select string_agg(policyname, ',' order by policyname) from pg_policies where tablename='objects'")
[ "$before" = "$after" ] && same=yes || same=no
echo "stopped: $stopped (expected yes) | policies unchanged: $same (expected yes)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$live_old" -gt 0 ] && [ "$live_new" -eq 0 ] && [ "$stopped" = yes ] && [ "$same" = yes ] && echo "ALL STORAGE CHECKS PASSED"
