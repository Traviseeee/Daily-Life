-- Undo 20261106_family_chat.sql: removes ONLY the chat tables and functions it added
-- (all chat messages are deleted with them). Families, members, profiles and
-- app_data are not touched.
begin;
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_messages') then
    alter publication supabase_realtime drop table public.family_messages;
  end if;
end $$;
drop function if exists public.family_chat_read(uuid);
drop function if exists public.family_chat_delete(uuid);
drop function if exists public.family_chat_react(uuid, text);
drop function if exists public.family_chat_send(uuid, text, text, jsonb);
drop function if exists public.family_chat_open_dm(uuid, uuid);
drop function if exists public.family_chat_list(uuid);
drop table if exists public.family_chat_reads;
drop table if exists public.family_messages;
drop table if exists public.family_chats;
drop function if exists public.family_chat_can(uuid);
commit;
