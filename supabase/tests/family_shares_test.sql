-- prints "fails|total" last
create temp table r (ok boolean, name text);
grant all on r to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444') on conflict do nothing;
insert into public.families (id, owner_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
insert into public.family_members (family_id, user_id, role, permissions) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin', '{}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member', '{"calendar":true,"savings":true,"money":false}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'viewer', '{"money":true}');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into r select public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'calendar', '{"events":[{"title":"Trip"}]}') is not null, 'admin shares calendar';
insert into r select public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'money', '{"spent":10}') is not null, 'admin shares money';
insert into r select public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'savings', '{"goals":[]}') is not null, 'admin shares savings';
insert into r select public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bills', '{"bills":[]}') is not null, 'admin shares bills';
insert into r select count(*) = 4, 'admin reads own 4 rows' from public.family_shares;
insert into r select public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'calendar', '{"events":[{"title":"Trip 2"}]}') is not null and (select count(*) from public.family_shares where section = 'calendar') = 1, 'saving again keeps one row';
do $$ begin perform public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'passwords', '{}'); insert into r values (false, 'unknown section refused'); exception when others then insert into r values (true, 'unknown section refused'); end $$;
do $$ begin perform public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'money', jsonb_build_object('x', repeat('a', 1000001))); insert into r values (false, 'too big refused'); exception when others then insert into r values (true, 'too big refused'); end $$;
do $$ begin insert into public.family_shares (family_id, owner_id, section) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'myEvents'); insert into r values (false, 'direct insert refused'); exception when others then insert into r values (true, 'direct insert refused'); end $$;
-- Lychee: calendar + savings on, money off, bills not set
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into r select count(*) = 2 and bool_and(section in ('calendar', 'savings')), 'member reads only switched-on sections' from public.family_shares;
insert into r select (data -> 'events' -> 0 ->> 'title') = 'Trip 2', 'member reads the newest copy' from public.family_shares where section = 'calendar';
do $$ begin perform public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'calendar', '{}'); insert into r values (false, 'member cannot share'); exception when others then insert into r values (true, 'member cannot share'); end $$;
do $$ declare n int; begin update public.family_shares set data = '{}'; get diagnostics n = row_count; insert into r values (n = 0, 'member cannot change a copy'); exception when others then insert into r values (true, 'member cannot change a copy'); end $$;
-- Sophy (viewer): money only
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into r select count(*) = 1 and min(section) = 'money', 'viewer reads only money' from public.family_shares;
-- outsider
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
insert into r select count(*) = 0, 'outsider reads nothing' from public.family_shares;
do $$ begin perform public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'calendar', '{}'); insert into r values (false, 'outsider cannot share'); exception when others then insert into r values (true, 'outsider cannot share'); end $$;
-- admin turns Lychee's calendar off → gone for her at once; turns money on → appears
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.family_members set permissions = '{"calendar":false,"savings":true,"money":true}' where user_id = '22222222-2222-2222-2222-222222222222';
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into r select count(*) = 2 and bool_and(section in ('money', 'savings')), 'switch off hides, switch on shows' from public.family_shares;
-- joint account: only the partner on it reads it, even with the Savings switch off
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.family_members set permissions = '{"savings":false}' where user_id = '22222222-2222-2222-2222-222222222222';
select public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'joint:22222222-2222-2222-2222-222222222222', '{"savings":[{"name":"Joint"}]}') \gset
do $$ begin perform public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'joint:44444444-4444-4444-4444-444444444444', '{}'); insert into r values (false, 'joint for an outsider refused'); exception when others then insert into r values (true, 'joint for an outsider refused'); end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into r select count(*) = 1 and min(section) = 'joint:22222222-2222-2222-2222-222222222222', 'partner reads the joint account with savings off' from public.family_shares;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into r select count(*) = 0, 'another member does not read that joint account' from public.family_shares where section like 'joint:%';
-- admin empties a section
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.family_share_put('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'money', null) \gset
insert into r select data = '{}'::jsonb, 'null empties the copy' from public.family_shares where section = 'money';
reset role;
select name, ok from r order by ok, name;
select count(*) filter (where not ok) || '|' || count(*) from r;
