#!/usr/bin/env bash
# Family chat (supabase/migrations/20261106_family_chat.sql).
# Needs a local, throwaway Postgres (PGHOST/PGPORT/PGUSER). Never point it at Supabase.
# Usage: PGHOST=/tmp PGPORT=5433 PGUSER=postgres tools/verify-family-chat.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=mylife_chat_qc
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/supabase_stub.sql >/dev/null
run -c "create table if not exists auth.users (id uuid primary key); grant select on auth.users to authenticated; create publication supabase_realtime;" >/dev/null
run -f supabase/migrations/20261023_family_core.sql >/dev/null
run -f supabase/migrations/20261106_family_chat.sql >/dev/null
run -f supabase/migrations/20261106_family_chat.sql >/dev/null   # running twice is safe
pub=$(run -tA -c "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='family_messages'")
run -f supabase/tests/family_chat_test.sql
fails=$(run -tA -f supabase/tests/family_chat_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
core=$(run -tA -f supabase/tests/family_core_policies_test.sql | grep -E '^[0-9]+\|[0-9]+$' | cut -d'|' -f1)
run -f supabase/migrations/20261106_family_chat_rollback.sql >/dev/null
left=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'family_chat%' or table_name = 'family_messages'")
fam=$(run -tA -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('families','family_members','family_invites')")
echo "chat failing: $fails (0) | old family tests failing: $core (0) | realtime: $pub (1) | chat tables after rollback: $left (0) | family tables kept: $fam (3)"
psql -q -d postgres -c "drop database $DB" >/dev/null
[ "$fails" -eq 0 ] && [ "$core" -eq 0 ] && [ "$pub" -eq 1 ] && [ "$left" -eq 0 ] && [ "$fam" -eq 3 ]
