-- Local test for 20261023_family_core.sql. Users: A owner, B joins as member,
-- C outsider, D joins as viewer, + anonymous. One transaction, ends with ROLLBACK.
-- Local throwaway Postgres only (tools/verify-family-core.sh) — never on Supabase.
begin;
create temp table r (n serial, test text, expected text, actual text) on commit drop;
create temp table v (k text primary key, val text) on commit drop;
grant all on r, v to anon, authenticated; grant usage, select on sequence r_n_seq to anon, authenticated;
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444')
on conflict do nothing;

-- A: create the family, invite B (member) and D (viewer)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare f uuid; f2 uuid; t text; p jsonb; begin
  f := public.create_family('Chin family', 'Tra');
  insert into v values ('fid', f::text);
  f2 := public.create_family('again');
  insert into r (test, expected, actual) values ('A: create_family twice → same family', 'same', case when f = f2 then 'same' else 'new' end);
  t := public.create_family_invite(f, 'member', '{"memories":true,"money":true,"hack":true,"calendar":"yes"}'::jsonb);
  insert into v values ('t1', t);
  select permissions into p from public.family_invites where token = t;
  insert into r (test, expected, actual) values ('A: unknown permission keys dropped', 'no hack', case when p ? 'hack' then 'has hack' else 'no hack' end);
  insert into v values ('t2', public.create_family_invite(f, 'viewer', '{"memories":true}'::jsonb));
  begin perform public.create_family_invite(f, 'admin', '{}'); insert into r (test, expected, actual) values ('A: invite as admin role', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: invite as admin role', 'denied', 'denied'); end;
  insert into r (test, expected, actual) values ('A: token is long + random', 'ok', case when length(t) >= 64 then 'ok' else 'short' end);
end $$;
reset role;
insert into public.family_invites (token, family_id, role, expires_at)
  select 'expired-token-000000000000000000000000', (select val::uuid from v where k = 'fid'), 'member', now() - interval '1 day';

-- C: outsider sees and does nothing
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ declare n int; f uuid := (select val::uuid from v where k = 'fid'); begin
  select count(*) into n from public.families; insert into r (test, expected, actual) values ('C: sees families', 'sees 0', 'sees ' || n);
  select count(*) into n from public.family_members; insert into r (test, expected, actual) values ('C: sees members', 'sees 0', 'sees ' || n);
  select count(*) into n from public.family_invites; insert into r (test, expected, actual) values ('C: sees invites', 'sees 0', 'sees ' || n);
  begin perform public.create_family_invite(f, 'member', '{}'); insert into r (test, expected, actual) values ('C: invites into A family', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: invites into A family', 'denied', 'denied'); end;
  begin insert into public.family_members (family_id, user_id, role) values (f, '33333333-3333-3333-3333-333333333333', 'admin'); insert into r (test, expected, actual) values ('C: inserts self as admin', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: inserts self as admin', 'denied', 'denied'); end;
  update public.families set name = 'hacked' where id = f; get diagnostics n = row_count; insert into r (test, expected, actual) values ('C: renames A family', 'changed 0', 'changed ' || n);
  begin perform public.accept_family_invite('no-such-token-0000000000000000000000'); insert into r (test, expected, actual) values ('C: fake token', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: fake token', 'denied', 'denied'); end;
  begin perform public.accept_family_invite('expired-token-000000000000000000000000'); insert into r (test, expected, actual) values ('C: expired invite', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: expired invite', 'denied', 'denied'); end;
end $$;

-- B: joins with the link
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare n int; f uuid := (select val::uuid from v where k = 'fid'); t text := (select val from v where k = 't1'); s text; f2 uuid; begin
  select status into s from public.family_invite_preview(t); insert into r (test, expected, actual) values ('B: preview before joining', 'ok', coalesce(s, 'none'));
  f2 := public.accept_family_invite(t, 'Mak'); insert into r (test, expected, actual) values ('B: joins A family', 'joined', case when f2 = f then 'joined' else 'other' end);
  f2 := public.accept_family_invite(t, 'Mak'); select count(*) into n from public.family_members where user_id = '22222222-2222-2222-2222-222222222222';
  insert into r (test, expected, actual) values ('B: opens link again → still 1 row', '1 row', n || ' row');
  select count(*) into n from public.family_members; insert into r (test, expected, actual) values ('B: sees family members', 'sees 2', 'sees ' || n);
  select count(*) into n from public.family_invites; insert into r (test, expected, actual) values ('B (member): sees invites', 'sees 0', 'sees ' || n);
  begin update public.family_members set role = 'admin' where user_id = '22222222-2222-2222-2222-222222222222'; insert into r (test, expected, actual) values ('B: makes self admin', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: makes self admin', 'denied', 'denied'); end;
  begin update public.family_members set permissions = '{"money":true}' where user_id = '22222222-2222-2222-2222-222222222222'; insert into r (test, expected, actual) values ('B: turns on money for self', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: turns on money for self', 'denied', 'denied'); end;
  update public.family_members set display_name = 'Mak Srey' where user_id = '22222222-2222-2222-2222-222222222222'; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('B: renames self', 'changed 1', 'changed ' || n);
  update public.family_members set display_name = 'x' where user_id = '11111111-1111-1111-1111-111111111111'; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('B: renames A', 'changed 0', 'changed ' || n);
  delete from public.family_members where user_id = '11111111-1111-1111-1111-111111111111'; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('B: removes A', 'deleted 0', 'deleted ' || n);
  begin perform public.create_family_invite(f, 'member', '{}'); insert into r (test, expected, actual) values ('B (member): invites', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B (member): invites', 'denied', 'denied'); end;
end $$;

-- D: the used link fails, the viewer link works
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$ declare s text; begin
  begin perform public.accept_family_invite((select val from v where k = 't1')); insert into r (test, expected, actual) values ('D: reuses B link', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D: reuses B link', 'denied', 'denied'); end;
  perform public.accept_family_invite((select val from v where k = 't2'), 'Yeay');
  select role into s from public.family_members where user_id = '44444444-4444-4444-4444-444444444444';
  insert into r (test, expected, actual) values ('D: joins as viewer', 'viewer', coalesce(s, 'none'));
end $$;

-- A: admin changes, removes; owner stays admin
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare n int; p jsonb; begin
  update public.family_members set permissions = '{"memories":true,"money":true,"evil":true}' where user_id = '22222222-2222-2222-2222-222222222222';
  select permissions into p from public.family_members where user_id = '22222222-2222-2222-2222-222222222222';
  insert into r (test, expected, actual) values ('A: turns money on for B (cleaned)', 'money on, no evil', case when (p ->> 'money')::boolean and not p ? 'evil' then 'money on, no evil' else p::text end);
  begin update public.family_members set role = 'member' where user_id = '11111111-1111-1111-1111-111111111111'; insert into r (test, expected, actual) values ('A: demotes self (owner)', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: demotes self (owner)', 'denied', 'denied'); end;
  begin delete from public.family_members where user_id = '11111111-1111-1111-1111-111111111111'; insert into r (test, expected, actual) values ('A: removes self (owner)', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: removes self (owner)', 'denied', 'denied'); end;
  select count(*) into n from public.family_invites; insert into r (test, expected, actual) values ('A: sees own invites', 'sees 3', 'sees ' || n);
  delete from public.family_members where user_id = '22222222-2222-2222-2222-222222222222'; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('A: removes B', 'deleted 1', 'deleted ' || n);
end $$;

-- B after removal sees nothing; D leaves on their own
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare n int; begin
  select count(*) into n from public.family_members; insert into r (test, expected, actual) values ('B removed: sees members', 'sees 0', 'sees ' || n);
end $$;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$ declare n int; begin
  delete from public.family_members where user_id = '44444444-4444-4444-4444-444444444444'; get diagnostics n = row_count;
  insert into r (test, expected, actual) values ('D: leaves the family', 'deleted 1', 'deleted ' || n);
end $$;

-- anonymous
reset role; set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare n int; begin
  begin select count(*) into n from public.families; insert into r (test, expected, actual) values ('anon: reads families', 'denied', 'sees ' || n);
  exception when others then insert into r (test, expected, actual) values ('anon: reads families', 'denied', 'denied'); end;
  begin perform public.accept_family_invite((select val from v where k = 't2')); insert into r (test, expected, actual) values ('anon: accepts invite', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('anon: accepts invite', 'denied', 'denied'); end;
end $$;

-- A deletes the family → members + invites go with it
reset role; set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare n int; begin
  delete from public.families; get diagnostics n = row_count; insert into r (test, expected, actual) values ('A: deletes own family', 'deleted 1', 'deleted ' || n);
end $$;
reset role;
insert into r (test, expected, actual) select 'family delete cleans members + invites', '0 left',
  ((select count(*) from public.family_members) + (select count(*) from public.family_invites)) || ' left';

select n, test, expected, actual, case when expected = actual then 'PASS' else 'FAIL' end from r order by n;
select count(*) filter (where expected <> actual) as failures, count(*) as total from r;
rollback;
