-- Rebuild identity schema with parent + wallet profiles
-- UP

begin;

-- Drop legacy single-profile table
drop table if exists public.users cascade;

-- Core trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Parent + wallet profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  parent_profile_id uuid references public.profiles(id) on delete cascade,
  display_name text,
  photo_url text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_profiles_parent_or_child check (
    (auth_user_id is not null and parent_profile_id is null)
    or (auth_user_id is null and parent_profile_id is not null)
  )
);

alter table public.profiles
  add constraint fk_profiles_auth_user
  foreign key (auth_user_id) references auth.users(id) on delete cascade;

create index if not exists idx_profiles_parent on public.profiles(parent_profile_id);

-- Updated at trigger
drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Profile credentials (email, wallet, etc.)
create table if not exists public.profile_credentials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (char_length(kind) > 0),
  value text not null check (char_length(value) > 0),
  created_at timestamptz not null default now(),
  unique (profile_id, kind),
  unique (kind, value)
);

create index if not exists idx_profile_credentials_profile on public.profile_credentials(profile_id);
create index if not exists idx_profile_credentials_kind_value on public.profile_credentials(kind, value);

-- Cubid assignments timeline per profile
create table if not exists public.profiles_cubid (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cubid_id text not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  constraint pk_profiles_cubid primary key (profile_id, valid_from),
  constraint chk_profiles_cubid_valid_range check (valid_to is null or valid_to > valid_from)
);

create unique index if not exists idx_profiles_cubid_active on public.profiles_cubid(cubid_id) where valid_to is null;

-- View of latest Cubid per profile
create or replace view public.profiles_current_cubid as
select distinct on (profile_id)
  profile_id,
  cubid_id,
  valid_from,
  valid_to,
  created_at
from public.profiles_cubid
order by profile_id, valid_from desc;

-- Enriched view for frontend consumption
create or replace view public.profiles_enriched as
select
  p.id,
  p.auth_user_id,
  p.parent_profile_id,
  p.display_name,
  p.photo_url,
  p.locked_at,
  p.created_at,
  p.updated_at,
  c.cubid_id,
  email.value as email_address,
  wallet.value as wallet_address
from public.profiles p
left join public.profiles_current_cubid c on c.profile_id = p.id
left join public.profile_credentials email on email.profile_id = p.id and email.kind = 'email'
left join public.profile_credentials wallet on wallet.profile_id = p.id and wallet.kind = 'wallet';

-- Controlled creation helper
create or replace function public.create_profile_with_credential(kind text, value text, auth_user uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_id uuid;
  new_profile public.profiles;
begin
  if auth_user is null then
    raise exception 'auth_user is required';
  end if;
  if kind is null or trim(kind) = '' then
    raise exception 'credential kind is required';
  end if;
  if value is null or trim(value) = '' then
    raise exception 'credential value is required';
  end if;

  select id into parent_id
  from public.profiles
  where auth_user_id = auth_user
  limit 1;

  if parent_id is null then
    insert into public.profiles (auth_user_id)
    values (auth_user)
    returning id into parent_id;
  end if;

  insert into public.profiles (parent_profile_id)
  values (parent_id)
  returning * into new_profile;

  insert into public.profile_credentials (profile_id, kind, value)
  values (new_profile.id, kind, value);

  return new_profile;
end;
$$;

-- Row level security policies
alter table public.profiles enable row level security;
alter table public.profile_credentials enable row level security;
alter table public.profiles_cubid enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles
for select
using (
  auth.uid() = auth_user_id
  or exists (
    select 1 from public.profiles parent
    where parent.id = public.profiles.parent_profile_id
      and parent.auth_user_id = auth.uid()
  )
);

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert
on public.profiles
for insert
with check (auth.uid() = auth_user_id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
using (
  auth.uid() = auth_user_id
  or (
    exists (
      select 1 from public.profiles parent
      where parent.id = public.profiles.parent_profile_id
        and parent.auth_user_id = auth.uid()
    )
    and public.profiles.locked_at is null
  )
)
with check (
  auth.uid() = auth_user_id
  or (
    exists (
      select 1 from public.profiles parent
      where parent.id = public.profiles.parent_profile_id
        and parent.auth_user_id = auth.uid()
    )
    and public.profiles.locked_at is null
  )
);

drop policy if exists profile_credentials_select on public.profile_credentials;
create policy profile_credentials_select
on public.profile_credentials
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and (
        p.auth_user_id = auth.uid()
        or exists (
          select 1 from public.profiles parent
          where parent.id = p.parent_profile_id
            and parent.auth_user_id = auth.uid()
        )
      )
  )
);

drop policy if exists profile_credentials_insert on public.profile_credentials;
create policy profile_credentials_insert
on public.profile_credentials
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and (
        p.auth_user_id = auth.uid()
        or exists (
          select 1 from public.profiles parent
          where parent.id = p.parent_profile_id
            and parent.auth_user_id = auth.uid()
        )
      )
  )
);

drop policy if exists profile_credentials_delete on public.profile_credentials;
create policy profile_credentials_delete
on public.profile_credentials
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists profiles_cubid_select on public.profiles_cubid;
create policy profiles_cubid_select
on public.profiles_cubid
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and (
        p.auth_user_id = auth.uid()
        or exists (
          select 1 from public.profiles parent
          where parent.id = p.parent_profile_id
            and parent.auth_user_id = auth.uid()
        )
      )
  )
);

drop policy if exists profiles_cubid_insert on public.profiles_cubid;
create policy profiles_cubid_insert
on public.profiles_cubid
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and (
        p.auth_user_id = auth.uid()
        or exists (
          select 1 from public.profiles parent
          where parent.id = p.parent_profile_id
            and parent.auth_user_id = auth.uid()
        )
      )
  )
);

drop policy if exists profiles_cubid_update on public.profiles_cubid;
create policy profiles_cubid_update
on public.profiles_cubid
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and (
        p.auth_user_id = auth.uid()
        or exists (
          select 1 from public.profiles parent
          where parent.id = p.parent_profile_id
            and parent.auth_user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = profile_id
      and (
        p.auth_user_id = auth.uid()
        or exists (
          select 1 from public.profiles parent
          where parent.id = p.parent_profile_id
            and parent.auth_user_id = auth.uid()
        )
      )
  )
);

-- Grants
grant all on table public.profiles to service_role;
grant all on table public.profile_credentials to service_role;
grant all on table public.profiles_cubid to service_role;
grant select on public.profiles_enriched to authenticated;
grant select on public.profiles_current_cubid to authenticated;

commit;

-- DOWN

begin;

drop view if exists public.profiles_enriched;
drop view if exists public.profiles_current_cubid;
drop function if exists public.create_profile_with_credential;
drop table if exists public.profiles_cubid cascade;
drop table if exists public.profile_credentials cascade;
drop table if exists public.profiles cascade;

drop table if exists public.users cascade;

create table if not exists public.users (
  user_id uuid primary key,
  cubid_id text unique,
  evm_address text unique,
  display_name text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

alter table public.users enable row level security;

drop policy if exists users_self_select on public.users;
create policy users_self_select
on public.users for select
to authenticated
using (user_id = auth.uid());

drop policy if exists users_self_upsert on public.users;
create policy users_self_upsert
on public.users for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists users_self_update on public.users;
create policy users_self_update
on public.users for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant all on table public.users to service_role;

commit;
