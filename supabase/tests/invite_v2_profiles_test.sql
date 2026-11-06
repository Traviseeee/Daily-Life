-- Local test for 20261106_invite_v2_profiles.sql. A owner/admin, B joins with a code,
-- C asks with a never-expire link (approval), D outsider, E declined. ROLLBACK at the end.
begin;
create temp table r (n serial, test text, expected text, actual text) on commit drop;
create temp table v (k text primary key, val text) on commit drop;
grant all on r, v to anon, authenticated; grant usage, select on sequence r_n_seq to anon, authenticated;
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555') on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ declare f uuid; t text; c text; t2 text; c2 text; begin
  f := public.create_family('Tra family', 'Tra'); insert into v values ('fid', f::text);
  select x.token, x.code into t, c from public.create_family_invite_v2(f, 'member', '{"memories":true}', 7, 1, 'Lychee', 'card-ly') x;
  insert into v values ('t1', t), ('c1', c);
  insert into r (test, expected, actual) values ('A: code is 6 chars', 'ok', case when c ~ '^[A-Z2-9]{6}$' then 'ok' else coalesce(c, 'null') end);
  insert into r (test, expected, actual) values ('A: 7-day 1-use needs no approval', 'false', (select needs_approval::text from public.family_invites where token = t));
  select x.token, x.code into t2, c2 from public.create_family_invite_v2(f, 'viewer', '{}', null, 5, 'Family link', null) x;
  insert into v values ('t2', t2);
  insert into r (test, expected, actual) values ('A: never-expire link needs approval', 'true', (select needs_approval::text from public.family_invites where token = t2));
  insert into r (test, expected, actual) values ('A: never-expire link has no expiry', 'null', coalesce((select expires_at::text from public.family_invites where token = t2), 'null'));
  insert into v values ('t3', (select x.token from public.create_family_invite_v2(f, 'member', '{}', 1, 1) x));
  begin perform public.create_family_invite_v2(f, 'admin', '{}'); insert into r (test, expected, actual) values ('A: admin role link', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: admin role link', 'denied', 'denied'); end;
  begin perform public.create_family_invite_v2(f, 'member', '{}', 7, 99); insert into r (test, expected, actual) values ('A: 99 uses', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('A: 99 uses', 'denied', 'denied'); end;
  insert into public.member_profiles (user_id, display_name, bio, phone, hidden) values ('11111111-1111-1111-1111-111111111111', 'Tra', 'hi', '012', '{"phone":true}');
end $$;
reset role;

-- D outsider: cannot make links, cannot read profiles / uses
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
do $$ begin
  begin perform public.create_family_invite_v2((select val::uuid from v where k = 'fid'), 'member', '{}'); insert into r (test, expected, actual) values ('D: outsider makes link', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D: outsider makes link', 'denied', 'denied'); end;
  insert into r (test, expected, actual) values ('D: outsider sees family profiles', '0', (select count(*)::text from public.family_profiles((select val::uuid from v where k = 'fid'))));
  insert into r (test, expected, actual) values ('D: outsider reads member_profiles', '0', (select count(*)::text from public.member_profiles));
  insert into r (test, expected, actual) values ('D: outsider reads invite uses', '0', (select count(*)::text from public.family_invite_uses));
  insert into r (test, expected, actual) values ('D: outsider reads invites', '0', (select count(*)::text from public.family_invites));
  begin update public.member_profiles set bio = 'hacked' where user_id = '11111111-1111-1111-1111-111111111111'; exception when others then null; end;
  begin insert into public.member_profiles (user_id, bio) values ('11111111-1111-1111-1111-111111111111', 'x');
    insert into r (test, expected, actual) values ('D: write someone else profile', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('D: write someone else profile', 'denied', 'denied'); end;
end $$;
reset role;

-- B joins with the CODE (lower case is fine)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ declare s text; p record; begin
  select x.status, x.needs_approval into p from public.family_invite_preview_v2(lower((select val from v where k = 'c1'))) x;
  insert into r (test, expected, actual) values ('B: preview by code', 'ok/false', coalesce(p.status, 'none') || '/' || coalesce(p.needs_approval::text, '?'));
  select x.status into s from public.accept_family_invite_v2(lower((select val from v where k = 'c1')), 'Lychee') x;
  insert into r (test, expected, actual) values ('B: join with code', 'joined', s);
  insert into r (test, expected, actual) values ('B: now a member', '1', (select count(*)::text from public.family_members where user_id = '22222222-2222-2222-2222-222222222222'));
  insert into public.member_profiles (user_id, display_name, bio, birthday, telegram, hidden) values ('22222222-2222-2222-2222-222222222222', 'Lychee', 'cats', '1999-09-12', '@ly', '{"birthday":true}');
  insert into r (test, expected, actual) values ('B: sees Tra bio', 'hi', (select bio from public.family_profiles((select val::uuid from v where k = 'fid')) where user_id = '11111111-1111-1111-1111-111111111111'));
  insert into r (test, expected, actual) values ('B: Tra phone hidden', 'null', coalesce((select phone from public.family_profiles((select val::uuid from v where k = 'fid')) where user_id = '11111111-1111-1111-1111-111111111111'), 'null'));
  insert into r (test, expected, actual) values ('B: sees own hidden birthday', '1999-09-12', (select birthday::text from public.family_profiles((select val::uuid from v where k = 'fid')) where user_id = '22222222-2222-2222-2222-222222222222'));
end $$;
reset role;

-- E tries the used 1-use code
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$ declare s text; begin
  begin perform public.accept_family_invite_v2((select val from v where k = 'c1'), 'E');
    insert into r (test, expected, actual) values ('E: reuse 1-use code', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('E: reuse 1-use code', 'denied', 'denied'); end;
  select x.status into s from public.accept_family_invite_v2((select val from v where k = 't2'), 'E') x;
  insert into r (test, expected, actual) values ('E: family link → pending', 'pending', s);
  begin perform public.accept_family_invite((select val from v where k = 't2'), 'E');
    insert into r (test, expected, actual) values ('E: old join skips approval', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('E: old join skips approval', 'denied', 'denied'); end;
end $$;
reset role;

-- C asks with the family link
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ declare s text; begin
  select x.status into s from public.accept_family_invite_v2((select val from v where k = 't2'), 'Mom') x;
  insert into r (test, expected, actual) values ('C: family link → pending', 'pending', s);
  insert into r (test, expected, actual) values ('C: not a member yet', '0', (select count(*)::text from public.family_members where user_id = '33333333-3333-3333-3333-333333333333'));
  begin perform public.decide_family_join((select val from v where k = 't2'), '33333333-3333-3333-3333-333333333333', true);
    insert into r (test, expected, actual) values ('C: approves self', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('C: approves self', 'denied', 'denied'); end;
end $$;
reset role;

-- B (member, not admin) cannot approve or cancel
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin
  begin perform public.decide_family_join((select val from v where k = 't2'), '33333333-3333-3333-3333-333333333333', true);
    insert into r (test, expected, actual) values ('B: member approves', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: member approves', 'denied', 'denied'); end;
  begin perform public.cancel_family_invite((select val from v where k = 't3'));
    insert into r (test, expected, actual) values ('B: member cancels link', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('B: member cancels link', 'denied', 'denied'); end;
end $$;
reset role;

-- A approves C, declines E, cancels t3
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  insert into r (test, expected, actual) values ('A: sees 2 waiting', '2', (select count(*)::text from public.family_invite_uses where status = 'pending'));
  insert into r (test, expected, actual) values ('A: approve C', 'joined', public.decide_family_join((select val from v where k = 't2'), '33333333-3333-3333-3333-333333333333', true));
  insert into r (test, expected, actual) values ('A: decline E', 'rejected', public.decide_family_join((select val from v where k = 't2'), '55555555-5555-5555-5555-555555555555', false));
  insert into r (test, expected, actual) values ('A: C is viewer', 'viewer', (select role from public.family_members where user_id = '33333333-3333-3333-3333-333333333333'));
  insert into r (test, expected, actual) values ('A: use_count 1', '1', (select use_count::text from public.family_invites where token = (select val from v where k = 't2')));
  perform public.cancel_family_invite((select val from v where k = 't3'));
  insert into r (test, expected, actual) values ('A: cancelled link kept', 'cancelled', (select public.family_invite_status(x) from public.family_invites x where token = (select val from v where k = 't3')));
  insert into r (test, expected, actual) values ('A: sees card link', 'card-ly/22222222-2222-2222-2222-222222222222',
    (select i.member_card_id || '/' || u.user_id from public.family_invites i join public.family_invite_uses u on u.token = i.token where i.member_card_id is not null and u.status = 'joined'));
  insert into r (test, expected, actual) values ('A: B birthday hidden', 'null', coalesce((select birthday::text from public.family_profiles((select val::uuid from v where k = 'fid')) where user_id = '22222222-2222-2222-2222-222222222222'), 'null'));
  insert into r (test, expected, actual) values ('A: sees 3 profiles', '3', (select count(*)::text from public.family_profiles((select val::uuid from v where k = 'fid'))));
end $$;
reset role;

-- E (declined) cannot ask again; cancelled link cannot be used
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
do $$ begin
  begin perform public.accept_family_invite_v2((select val from v where k = 't2'), 'E');
    insert into r (test, expected, actual) values ('E: ask again after decline', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('E: ask again after decline', 'denied', 'denied'); end;
  begin perform public.accept_family_invite_v2((select val from v where k = 't3'), 'E');
    insert into r (test, expected, actual) values ('E: cancelled link', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('E: cancelled link', 'denied', 'denied'); end;
end $$;
reset role;

-- anonymous: nothing
set local role anon;
do $$ begin
  begin perform public.family_invite_preview_v2('AAAAAA'); insert into r (test, expected, actual) values ('anon: preview', 'denied', 'allowed');
  exception when others then insert into r (test, expected, actual) values ('anon: preview', 'denied', 'denied'); end;
end $$;
reset role;

select n, test, expected, actual, case when expected = actual then 'PASS' else 'FAIL' end as result from r order by n;
select count(*) filter (where expected <> actual) as failing, count(*) as total from r;
rollback;
