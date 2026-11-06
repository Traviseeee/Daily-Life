#!/usr/bin/env bash
# Invite links v2 + member profiles (supabase/migrations/20261106_invite_v2_profiles.sql).
# Needs a local, throwaway Postgres (PGHOST/PGPORT/PGUSER). Never point it at Supabase.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tools/verify-invite-v2.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=mylife_invite_qc
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/supabase_stub.sql >/dev/null
run -c "create table if not exists auth.users (id uuid primary key); grant select on auth.users to authenticated;" >/dev/null
run -f supabase/migrations/20261023_family_core.sql >/dev/null
# an old-style link that already exists before the upgrade
run -c "insert into auth.users values ('99999999-9999-9999-9999-999999999999'); insert into public.families (id, name, owner_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'old', '99999999-9999-9999-9999-999999999999'); insert into public.family_invites (token, family_id, role) values (repeat('a', 64), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member');" >/dev/null
run -f supabase/migrations/20261106_invite_v2_profiles.sql >/dev/null
run -f supabase/migrations/20261106_invite_v2_profiles.sql >/dev/null   # running twice is safe
old=$(run -tA -c "select count(*) from public.family_invites where token = repeat('a', 64) and max_uses = 1 and expires_at is not null")
run -c "delete from public.families where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'" >/dev/null   # throwaway test DB: the old family test counts all invites
run -f supabase/tests/invite_v2_profiles_test.sql
fails=$(run -tA -f supabase/tests/invite_v2_profiles_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
run -f supabase/tests/family_core_policies_test.sql >/dev/null
core=$(run -tA -f supabase/tests/family_core_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
run -f supabase/migrations/20261106_invite_v2_profiles_rollback.sql >/dev/null
left=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('member_profiles','family_invite_uses')")
kept=$old
echo "v2 failing: $fails (0) | old family tests failing: $core (0) | old link kept: $old/$kept (1/1) | tables left after rollback: $left (0)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$fails" -eq 0 ] && [ "$core" -eq 0 ] && [ "$left" -eq 0 ] && [ "$old" -eq 1 ] && [ "$kept" -eq 1 ]
