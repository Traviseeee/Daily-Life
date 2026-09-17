create extension if not exists pgcrypto;

create table if not exists public.app_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_data_user_id_idx
  on public.app_data (user_id);

alter table public.app_data enable row level security;

create policy "Users can view their own app data"
  on public.app_data for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own app data"
  on public.app_data for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own app data"
  on public.app_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own app data"
  on public.app_data for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_data_updated_at on public.app_data;
create trigger app_data_updated_at
  before update on public.app_data
  for each row
  execute procedure public.handle_updated_at();

create policy "Public read access to images"
  on storage.objects for select
  using (bucket_id = 'images');

create policy "Authenticated users can upload images"
  on storage.objects for insert
  with check (
    bucket_id = 'images'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can update their own images"
  on storage.objects for update
  using (
    bucket_id = 'images'
    and auth.role() = 'authenticated'
  )
  with check (
    bucket_id = 'images'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can delete their own images"
  on storage.objects for delete
  using (
    bucket_id = 'images'
    and auth.role() = 'authenticated'
  );
