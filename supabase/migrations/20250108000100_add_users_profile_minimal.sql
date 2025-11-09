-- Core users profile (one row per auth user)
create table if not exists public.users (
  user_id uuid primary key,
  cubid_id text unique,
  evm_address text unique,
  display_name text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- RLS
alter table public.users enable row level security;

-- Authenticated user can read/update only self
create policy if not exists "users_self_select"
on public.users for select
to authenticated
using (user_id = auth.uid());

create policy if not exists "users_self_upsert"
on public.users for insert
to authenticated
with check (user_id = auth.uid());

create policy if not exists "users_self_update"
on public.users for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Service role full access (indexer / admin ops)
grant all on table public.users to service_role;
