-- Local test for 20261106_family_chat.sql. A owner/admin, B and C members, D outsider.
-- ROLLBACK at the end.
begin;
create temp table r (n serial, test text, expected text, actual text) on commit drop;
create temp table v (k text primary key, val text) on commit drop;
grant all on r, v to anon, authenticated; grant usage, select on sequence r_n_seq to anon, authenticated;
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444') on conflict do nothing;

-- A makes the family; B, C join (added directly here)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into v select 'fid', public.create_family('Tra family', 'Tra')::text;
reset role;
insert into public.family_members (family_id, user_id, role) select val::uuid, '22222222-2222-2222-2222-222222222222', 'member' from v where k = 'fid';
insert into public.family_members (family_id, user_id, role) select val::uuid, '33333333-3333-3333-3333-333333333333', 'viewer' from v where k = 'fid';

-- A: group chat appears, sends, opens a DM with B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); g uuid; d uuid; m public.family_messages; begin
  select chat_id into g from public.family_chat_list(f) where kind = 'group'; insert into v values ('group', g::text);
  insert into r (test, expected, actual) values ('A: group chat made on first list', 'yes', case when g is null then 'no' else 'yes' end);
  perform public.family_chat_list(f);
  insert into r (test, expected, actual) values ('A: listing twice keeps one group chat', '1', (select count(*)::text from public.family_chats where family_id = f and kind = 'group'));
  m := public.family_chat_send(g, 'text', '  សួស្តីទាំងអស់គ្នា  '); insert into v values ('m1', m.id::text);
  insert into r (test, expected, actual) values ('A: text is trimmed', 'សួស្តីទាំងអស់គ្នា', m.body);
  perform public.family_chat_send(g, 'sticker', null, '{"sticker":"love"}');
  d := public.family_chat_open_dm(f, '22222222-2222-2222-2222-222222222222'); insert into v values ('dm', d::text);
  insert into r (test, expected, actual) values ('A: opening the DM again gives the same chat', d::text, public.family_chat_open_dm(f, '22222222-2222-2222-2222-222222222222')::text);
  m := public.family_chat_send(d, 'share', 'paid', '{"title":"Car loan","amount":180}'); insert into v values ('dm1', m.id::text);
  begin perform public.family_chat_send(g, 'text', '   '); insert into r (test, expected, actual) values ('A: empty text', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: empty text', 'denied', 'denied'); end;
  begin perform public.family_chat_send(g, 'text', repeat('x', 1001)); insert into r (test, expected, actual) values ('A: 1001 chars', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: 1001 chars', 'denied', 'denied'); end;
  begin perform public.family_chat_send(g, 'html', 'x'); insert into r (test, expected, actual) values ('A: unknown kind', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: unknown kind', 'denied', 'denied'); end;
  begin perform public.family_chat_open_dm(f, '11111111-1111-1111-1111-111111111111'); insert into r (test, expected, actual) values ('A: DM with myself', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: DM with myself', 'denied', 'denied'); end;
  begin perform public.family_chat_open_dm(f, '44444444-4444-4444-4444-444444444444'); insert into r (test, expected, actual) values ('A: DM with outsider', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: DM with outsider', 'denied', 'denied'); end;
  begin insert into public.family_messages (chat_id, sender, body) values (g, auth.uid(), 'direct'); insert into r (test, expected, actual) values ('A: direct insert', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: direct insert', 'denied', 'denied'); end;
end $$;
reset role;

-- B: sees group + DM, unread counts, reacts, cannot delete A's message
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); g uuid := (select val::uuid from v where k = 'group'); d uuid := (select val::uuid from v where k = 'dm'); x jsonb; begin
  insert into r (test, expected, actual) values ('B: sees 2 chats', '2', (select count(*)::text from public.family_chat_list(f)));
  insert into r (test, expected, actual) values ('B: group unread', '2', (select unread::text from public.family_chat_list(f) where kind = 'group'));
  insert into r (test, expected, actual) values ('B: DM other user is A', '11111111-1111-1111-1111-111111111111', (select other_user::text from public.family_chat_list(f) where kind = 'dm'));
  insert into r (test, expected, actual) values ('B: reads DM message', '1', (select count(*)::text from public.family_messages where chat_id = d));
  perform public.family_chat_read(g);
  insert into r (test, expected, actual) values ('B: unread 0 after read', '0', (select unread::text from public.family_chat_list(f) where kind = 'group'));
  x := public.family_chat_react((select val::uuid from v where k = 'm1'), '❤️');
  insert into r (test, expected, actual) values ('B: ❤️ added', '1', jsonb_array_length(x -> '❤️')::text);
  x := public.family_chat_react((select val::uuid from v where k = 'm1'), '❤️');
  insert into r (test, expected, actual) values ('B: ❤️ again takes it back', 'null', coalesce((x -> '❤️')::text, 'null'));
  begin perform public.family_chat_react((select val::uuid from v where k = 'm1'), '💩'); insert into r (test, expected, actual) values ('B: other emoji', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: other emoji', 'denied', 'denied'); end;
  begin perform public.family_chat_delete((select val::uuid from v where k = 'm1')); insert into r (test, expected, actual) values ('B: deletes A message', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: deletes A message', 'denied', 'denied'); end;
  begin update public.family_messages set body = 'hack' where chat_id = g; insert into r (test, expected, actual) values ('B: direct update', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: direct update', 'denied', 'denied'); end;
  insert into r (test, expected, actual) values ('B: sees only own read marks', '1', (select count(*)::text from public.family_chat_reads));
end $$;
reset role;

-- C (viewer): group yes, A↔B DM no
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); g uuid := (select val::uuid from v where k = 'group'); d uuid := (select val::uuid from v where k = 'dm'); begin
  insert into r (test, expected, actual) values ('C: sees only the group', '1', (select count(*)::text from public.family_chat_list(f)));
  insert into r (test, expected, actual) values ('C: cannot read the A↔B DM', '0', (select count(*)::text from public.family_messages where chat_id = d));
  insert into r (test, expected, actual) values ('C: cannot see the DM row', '0', (select count(*)::text from public.family_chats where id = d));
  begin perform public.family_chat_send(d, 'text', 'hi'); insert into r (test, expected, actual) values ('C: writes into A↔B DM', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: writes into A↔B DM', 'denied', 'denied'); end;
  perform public.family_chat_send(g, 'text', 'C says hi');
  insert into r (test, expected, actual) values ('C: viewer can write in group', '3', (select count(*)::text from public.family_messages where chat_id = g));
end $$;
reset role;

-- D outsider: nothing
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$ declare f uuid := (select val::uuid from v where k = 'fid'); g uuid := (select val::uuid from v where k = 'group'); begin
  insert into r (test, expected, actual) values ('D: reads messages', '0', (select count(*)::text from public.family_messages));
  insert into r (test, expected, actual) values ('D: reads chats', '0', (select count(*)::text from public.family_chats));
  begin perform public.family_chat_list(f); insert into r (test, expected, actual) values ('D: lists chats', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D: lists chats', 'denied', 'denied'); end;
  begin perform public.family_chat_send(g, 'text', 'spam'); insert into r (test, expected, actual) values ('D: sends', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D: sends', 'denied', 'denied'); end;
  begin perform public.family_chat_react((select val::uuid from v where k = 'm1'), '❤️'); insert into r (test, expected, actual) values ('D: reacts', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D: reacts', 'denied', 'denied'); end;
end $$;
reset role;

-- A (admin) deletes C's group message; B leaves → the A↔B DM closes for A too
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare g uuid := (select val::uuid from v where k = 'group'); begin
  perform public.family_chat_delete((select id from public.family_messages where body = 'C says hi'));
  insert into r (test, expected, actual) values ('A: admin deleted C message (soft)', 'null', coalesce((select body from public.family_messages where sender = '33333333-3333-3333-3333-333333333333'), 'null'));
  perform public.family_chat_delete((select val::uuid from v where k = 'dm1'));
  insert into r (test, expected, actual) values ('A: deletes own DM message', 'yes', (select case when deleted_at is null then 'no' else 'yes' end from public.family_messages where id = (select val::uuid from v where k = 'dm1')));
end $$;
reset role;
delete from public.family_members where user_id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  insert into r (test, expected, actual) values ('A: DM gone after B left', '0', (select count(*)::text from public.family_messages where chat_id = (select val::uuid from v where k = 'dm')));
end $$;
reset role;
-- anon: nothing
set local role anon;
do $$ begin
  begin perform public.family_chat_list((select val::uuid from v where k = 'fid')); insert into r (test, expected, actual) values ('anon: list', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('anon: list', 'denied', 'denied'); end;
end $$;
reset role;

select n, test, expected, actual, case when expected = actual then 'PASS' else 'FAIL' end as result from r order by n;
select count(*) filter (where expected <> actual) as failing, count(*) as total from r;
rollback;
