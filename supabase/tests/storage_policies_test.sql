-- MYLIFE QC B3 — permission test for the "images" bucket policies.
-- Local test only. Hosted Supabase may block direct DELETE on storage tables
-- (Storage API only); there, check the same cases through the app / Storage API.
-- Two made-up users (A and B) and anonymous access, checked against the RLS
-- policies currently installed on storage.objects. Everything runs inside ONE
-- transaction that ends with ROLLBACK: no object row, policy or file is kept.
-- It writes only metadata rows to storage.objects (never real files).
-- Output: one row per test with expected / actual / PASS-FAIL.

begin;

create temp table qc_results (n serial, test text, expected text, actual text) on commit drop;
grant all on qc_results to anon, authenticated;
grant usage, select on sequence qc_results_n_seq to anon, authenticated;

-- seed as the table owner (bypasses RLS): one file each for A and B, and a legacy file
insert into storage.objects (bucket_id, name, owner) values
  ('images', 'users/11111111-1111-1111-1111-111111111111/qc/a.png', '11111111-1111-1111-1111-111111111111'),
  ('images', 'users/22222222-2222-2222-2222-222222222222/qc/b.png', '22222222-2222-2222-2222-222222222222'),
  ('images', 'uploads/qc-legacy.png', null);

/* ---------------- user A ---------------- */
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
declare n int;
begin
  -- T1 upload into own folder
  begin
    insert into storage.objects (bucket_id, name, owner) values ('images', 'users/11111111-1111-1111-1111-111111111111/qc/new.png', auth.uid());
    insert into qc_results (test, expected, actual) values ('T1 A uploads to users/A/', 'allowed', 'allowed');
  exception when others then
    insert into qc_results (test, expected, actual) values ('T1 A uploads to users/A/', 'allowed', 'denied');
  end;
  -- T2 upload into B's folder
  begin
    insert into storage.objects (bucket_id, name, owner) values ('images', 'users/22222222-2222-2222-2222-222222222222/qc/evil.png', auth.uid());
    insert into qc_results (test, expected, actual) values ('T2 A uploads to users/B/', 'denied', 'allowed');
  exception when others then
    insert into qc_results (test, expected, actual) values ('T2 A uploads to users/B/', 'denied', 'denied');
  end;
  -- T3 upload outside users/
  begin
    insert into storage.objects (bucket_id, name, owner) values ('images', 'uploads/evil.png', auth.uid());
    insert into qc_results (test, expected, actual) values ('T3 A uploads to uploads/', 'denied', 'allowed');
  exception when others then
    insert into qc_results (test, expected, actual) values ('T3 A uploads to uploads/', 'denied', 'denied');
  end;
  -- T4 list / read
  select count(*) into n from storage.objects where bucket_id = 'images' and name like 'users/11111111-1111-1111-1111-111111111111/%';
  insert into qc_results (test, expected, actual) values ('T4 A lists own folder', 'sees 2', 'sees ' || n);
  select count(*) into n from storage.objects where bucket_id = 'images' and name like 'users/22222222-2222-2222-2222-222222222222/%';
  insert into qc_results (test, expected, actual) values ('T5 A lists B''s folder', 'sees 0', 'sees ' || n);
  select count(*) into n from storage.objects where bucket_id = 'images' and name like 'uploads/%';
  insert into qc_results (test, expected, actual) values ('T6 A lists legacy uploads/', 'sees 0', 'sees ' || n);
  -- T7 update B's file (rename it into A's folder = take it over)
  begin
    update storage.objects set name = 'users/11111111-1111-1111-1111-111111111111/qc/stolen.png'
      where bucket_id = 'images' and name = 'users/22222222-2222-2222-2222-222222222222/qc/b.png';
    get diagnostics n = row_count;
    insert into qc_results (test, expected, actual) values ('T7 A updates/moves B''s file', 'changed 0', 'changed ' || n);
  exception when others then
    insert into qc_results (test, expected, actual) values ('T7 A updates/moves B''s file', 'changed 0', 'changed 0');
  end;
  -- T8 delete B's file
  delete from storage.objects where bucket_id = 'images' and name = 'users/22222222-2222-2222-2222-222222222222/qc/b.png';
  get diagnostics n = row_count;
  insert into qc_results (test, expected, actual) values ('T8 A deletes B''s file', 'deleted 0', 'deleted ' || n);
  -- T9 delete legacy file
  delete from storage.objects where bucket_id = 'images' and name = 'uploads/qc-legacy.png';
  get diagnostics n = row_count;
  insert into qc_results (test, expected, actual) values ('T9 A deletes legacy uploads/ file', 'deleted 0', 'deleted ' || n);
  -- T10 update own file (upsert path)
  update storage.objects set metadata = '{"qc":true}'::jsonb
    where bucket_id = 'images' and name = 'users/11111111-1111-1111-1111-111111111111/qc/a.png';
  get diagnostics n = row_count;
  insert into qc_results (test, expected, actual) values ('T10 A updates own file', 'changed 1', 'changed ' || n);
  -- T11 move own file into B's folder
  begin
    update storage.objects set name = 'users/22222222-2222-2222-2222-222222222222/qc/planted.png'
      where bucket_id = 'images' and name = 'users/11111111-1111-1111-1111-111111111111/qc/a.png';
    insert into qc_results (test, expected, actual) values ('T11 A moves own file into users/B/', 'denied', 'allowed');
  exception when others then
    insert into qc_results (test, expected, actual) values ('T11 A moves own file into users/B/', 'denied', 'denied');
  end;
  -- T12 delete own file
  delete from storage.objects where bucket_id = 'images' and name = 'users/11111111-1111-1111-1111-111111111111/qc/new.png';
  get diagnostics n = row_count;
  insert into qc_results (test, expected, actual) values ('T12 A deletes own file', 'deleted 1', 'deleted ' || n);
end $$;

/* ---------------- user B ---------------- */
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from storage.objects where bucket_id = 'images';
  insert into qc_results (test, expected, actual) values ('T13 B lists the whole bucket', 'sees 1 (own)', 'sees ' || n);
  delete from storage.objects where bucket_id = 'images' and name like 'users/11111111-1111-1111-1111-111111111111/%';
  get diagnostics n = row_count;
  insert into qc_results (test, expected, actual) values ('T14 B deletes A''s files', 'deleted 0', 'deleted ' || n);
end $$;

/* ---------------- not signed in ---------------- */
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare n int;
begin
  begin
    select count(*) into n from storage.objects where bucket_id = 'images';
    insert into qc_results (test, expected, actual) values ('T15 anonymous lists the bucket', 'sees 0', 'sees ' || n);
  exception when others then
    insert into qc_results (test, expected, actual) values ('T15 anonymous lists the bucket', 'sees 0', 'sees 0');
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('images', 'users/11111111-1111-1111-1111-111111111111/anon.png');
    insert into qc_results (test, expected, actual) values ('T16 anonymous uploads', 'denied', 'allowed');
  exception when others then
    insert into qc_results (test, expected, actual) values ('T16 anonymous uploads', 'denied', 'denied');
  end;
end $$;

reset role;
select n, test, expected, actual,
       case when expected = actual or (expected like 'sees 1%' and actual = 'sees 1') then 'PASS' else 'FAIL' end as result
from qc_results order by n;
select count(*) filter (where not (expected = actual or (expected like 'sees 1%' and actual = 'sees 1'))) as failures,
       count(*) as total
from qc_results;

rollback;
