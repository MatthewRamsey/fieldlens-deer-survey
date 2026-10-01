\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create table public.client_accounts (
  id uuid primary key, property_name text not null
);
create table public.digital_buck_books (
  id uuid primary key, client_account_id uuid not null references public.client_accounts(id),
  survey_year text not null, public_token uuid not null, status text not null
);
create table public.digital_bucks (
  id uuid primary key default gen_random_uuid(), book_id uuid not null references public.digital_buck_books(id),
  name text not null, age_class text not null default '', observations text not null default '',
  description text not null default '', print_selected boolean not null default true,
  display_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.digital_buck_images (
  id uuid primary key, buck_id uuid not null references public.digital_bucks(id),
  status text not null, is_highlight boolean not null, alt_text text not null default '',
  caption text not null default '', display_order integer not null default 0, created_at timestamptz not null default now()
);
create function public.can_manage_digital_client(uuid)
returns boolean language sql as $$ select true $$;
grant select on public.digital_buck_books, public.digital_bucks, public.digital_buck_images to authenticated;
grant insert, update, delete on public.digital_bucks to authenticated;

insert into public.client_accounts values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bradley Clark Farms'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Big Creek Farms');
insert into public.digital_buck_books values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2025', '31111111-1111-4111-8111-111111111111', 'published'),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026', '32222222-2222-4222-8222-222222222222', 'published'),
  ('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026', '33333333-3333-4333-8333-333333333333', 'draft');
insert into public.digital_bucks (id,book_id,name,age_class,observations,description,display_order) values
  ('41111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Big Boy','3.5','old observation','old description',0),
  ('42222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','North Eight','4.5','old observation','old description',0);
insert into public.digital_buck_images (id,buck_id,status,is_highlight,caption) values
  ('51111111-1111-4111-8111-111111111111','41111111-1111-4111-8111-111111111111','ready',true,'old caption');

begin;
\ir ../supabase/migrations/20261001183310_property_buck_bulk_upload.sql
commit;

begin;
\ir ../supabase/migrations/20261001195516_finalize_property_buck_bulk_upload.sql
commit;

do $$
declare result jsonb;
declare first_name text;
begin
  if (select string_agg(name, ',' order by buck_number) from public.digital_bucks)
    <> 'BCF1,BCF2' then raise exception 'existing buck names were not migrated in year order'; end if;
  if (select nickname from public.digital_bucks where buck_number = 1) <> 'Big Boy' then
    raise exception 'existing name was not preserved as nickname'; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and
    ((table_name='digital_bucks' and column_name in ('observations','description')) or
     (table_name='digital_buck_images' and column_name='caption'))) then
    raise exception 'old prose columns remain'; end if;
  if has_table_privilege('authenticated','public.digital_bucks','INSERT') then
    raise exception 'direct buck insert remains available'; end if;
  result := public.create_digital_buck_for_photo('22222222-2222-4222-8222-222222222222','5.5+',
    '61111111-1111-4111-8111-111111111111');
  first_name := result->>'name';
  if first_name <> 'BCF3' or result->>'created' <> 'true' then raise exception 'first new ID incorrect: %',result; end if;
  result := public.create_digital_buck_for_photo('22222222-2222-4222-8222-222222222222','5.5+',
    '61111111-1111-4111-8111-111111111111');
  if result->>'name' <> first_name or result->>'created' <> 'false' then raise exception 'retry duplicated buck'; end if;
  update public.digital_bucks set age_class = '2.5' where name = 'BCF3';
  if (select name from public.digital_bucks where age_class='2.5') <> 'BCF3' then raise exception 'age edit changed identifier'; end if;
  update public.client_accounts set property_name='Bradley Renamed Farms' where property_name='Bradley Clark Farms';
  insert into public.client_accounts(id, property_name) values
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Oak Run Preserve');
  if (select buck_prefix from public.client_accounts where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 'ORP' then
    raise exception 'new property prefix was not generated'; end if;
  for i in 1..100 loop
    perform public.create_digital_buck_for_photo('22222222-2222-4222-8222-222222222222','3.5',gen_random_uuid());
  end loop;
  if (select max(buck_number) from public.digital_bucks where client_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 103 then
    raise exception '100-buck sequence did not reach BCF103'; end if;
  if (select count(distinct name) from public.digital_bucks where client_account_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 103 then
    raise exception 'duplicate buck names'; end if;
  result := public.create_digital_buck_for_photo('33333333-3333-4333-8333-333333333333','3.5',gen_random_uuid());
  if result->>'name' <> 'BCF1' then raise exception 'second property should have own sequence'; end if;
end;
$$;

select 'PASS: migration, deletion, 100-buck sequence, retry, age stability, property rename, property isolation' as result;
