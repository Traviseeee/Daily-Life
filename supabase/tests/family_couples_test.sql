-- prints "fails|total" last
create temp table r (ok boolean, name text);
grant all on r to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444') on conflict do nothing;
insert into public.families (id, owner_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
insert into public.family_members (family_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member');
set role authenticated;
-- Tra sets the date with Lychee
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into r select (public.family_couple_set('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', date '2024-03-11')).start_date = date '2024-03-11', 'Tra sets the date';
insert into r select count(*) = 1, 'Tra reads it' from public.family_couples;
do $$ begin perform public.family_couple_set('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', date '2024-01-01'); insert into r values (false, 'outsider partner refused'); exception when others then insert into r values (true, 'outsider partner refused'); end $$;
do $$ begin perform public.family_couple_set('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', ((now() at time zone 'Asia/Phnom_Penh')::date + 5)); insert into r values (false, 'future date refused'); exception when others then insert into r values (true, 'future date refused'); end $$;
do $$ begin insert into public.family_couples (family_id, user_a, user_b, start_date) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', date '2020-01-01'); insert into r values (false, 'direct insert blocked'); exception when others then insert into r values (true, 'direct insert blocked'); end $$;
-- Lychee sees the same row and can change it (one row, not two)
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into r select count(*) = 1 and min(start_date) = date '2024-03-11', 'Lychee reads the same date' from public.family_couples;
insert into r select (public.family_couple_set('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', date '2024-03-10')).updated_by = '22222222-2222-2222-2222-222222222222', 'Lychee edits it';
insert into r select count(*) = 1 and min(start_date) = date '2024-03-10', 'still one row' from public.family_couples;
-- Sophy (same family, not in the couple) sees nothing
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into r select count(*) = 0, 'other family member sees nothing' from public.family_couples;
reset role;
-- if Lychee leaves the family, Tra no longer sees it
delete from public.family_members where user_id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into r select count(*) = 0, 'hidden after leaving' from public.family_couples;
reset role;
select name, ok from r order by ok, name;
select count(*) filter (where not ok) || '|' || count(*) from r;
