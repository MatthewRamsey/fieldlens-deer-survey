create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'client');
create type public.membership_role as enum ('owner', 'manager', 'viewer');

create table if not exists public.client_accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  property_name text not null,
  county text not null,
  acreage integer not null check (acreage > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.app_role not null default 'client',
  default_client_account_id uuid references public.client_accounts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.client_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_account_id uuid not null references public.client_accounts (id) on delete cascade,
  membership_role public.membership_role not null default 'viewer',
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, client_account_id)
);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;
revoke execute on function public.is_admin() from public, anon;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change profile roles.';
  end if;

  return new;
end;
$$;
revoke execute on function public.prevent_profile_role_escalation() from public, anon, authenticated;

revoke execute on function public.set_current_timestamp_updated_at() from public, anon, authenticated;

drop trigger if exists set_client_accounts_updated_at on public.client_accounts;
create trigger set_client_accounts_updated_at
before update on public.client_accounts
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_role_escalation();

insert into public.client_accounts (slug, name, property_name, county, acreage)
values
  ('cedar-ridge', 'Cedar Ridge Outfitters', 'Cedar Ridge', 'Macon County, Alabama', 1240),
  ('long-creek', 'Long Creek Farms', 'Long Creek Farms', 'Wilcox County, Georgia', 860),
  ('pine-hollow', 'Pine Hollow Holdings', 'Pine Hollow', 'Choctaw County, Mississippi', 1425)
on conflict (slug) do update
set
  name = excluded.name,
  property_name = excluded.property_name,
  county = excluded.county,
  acreage = excluded.acreage,
  is_active = true;

alter table public.client_accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.client_memberships enable row level security;

drop policy if exists "admins manage client accounts" on public.client_accounts;
create policy "admins manage client accounts"
on public.client_accounts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members read assigned client accounts" on public.client_accounts;
create policy "members read assigned client accounts"
on public.client_accounts
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.client_memberships memberships
    where memberships.client_account_id = client_accounts.id
      and memberships.user_id = auth.uid()
  )
);

drop policy if exists "users read own profile or admins read all" on public.profiles;
create policy "users read own profile or admins read all"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_admin()
);

drop policy if exists "users create own profile" on public.profiles;
create policy "users create own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "users update own profile or admins update all" on public.profiles;
create policy "users update own profile or admins update all"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_admin()
)
with check (
  auth.uid() = id
  or public.is_admin()
);

drop policy if exists "admins delete profiles" on public.profiles;
create policy "admins delete profiles"
on public.profiles
for delete
to authenticated
using (public.is_admin());

drop policy if exists "users read own memberships or admins read all" on public.client_memberships;
create policy "users read own memberships or admins read all"
on public.client_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "admins manage memberships" on public.client_memberships;
create policy "admins manage memberships"
on public.client_memberships
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.client_accounts to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.client_memberships to authenticated;
grant execute on function public.is_admin() to authenticated;
