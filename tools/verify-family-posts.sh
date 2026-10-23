#!/usr/bin/env bash
# Part 2B: shared family posts, ❤️, comments + storage read policy
# (supabase/migrations/20261023_family_posts.sql).
# Needs a local, throwaway Postgres (PGHOST/PGPORT/PGUSER). Never point it at Supabase.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tools/verify-family-posts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=mylife_family_posts_qc
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/supabase_stub.sql >/dev/null
run -c "create table if not exists auth.users (id uuid primary key); grant select on auth.users to authenticated;
        alter table storage.buckets add column if not exists file_size_limit bigint, add column if not exists allowed_mime_types text[];" >/dev/null
run -f supabase/migrations/20261022_family_media_bucket.sql >/dev/null
run -f supabase/migrations/20261023_family_core.sql >/dev/null
run -f supabase/migrations/20261023_family_posts.sql >/dev/null
run -f supabase/migrations/20261023_family_posts.sql >/dev/null   # running twice is safe
run -f supabase/tests/family_posts_policies_test.sql
fails=$(run -tA -f supabase/tests/family_posts_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
run -f supabase/migrations/20261023_family_posts_rollback.sql >/dev/null
left=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'family_post%'")
core=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('families','family_members','family_invites')")
echo "failing checks: $fails (expected 0) | post tables left after rollback: $left (expected 0) | 2A tables kept: $core (expected 3)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$fails" -eq 0 ] && [ "$left" -eq 0 ] && [ "$core" -eq 3 ]
