create table public.digital_buck_books (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  survey_year text not null check (survey_year ~ '^[0-9]{4}$'),
  public_token uuid not null default gen_random_uuid() unique,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_account_id, survey_year)
);

create table public.digital_bucks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.digital_buck_books(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  age_class text not null default '',
  observations text not null default '',
  print_selected boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.digital_buck_images (
  id uuid primary key default gen_random_uuid(),
  buck_id uuid not null references public.digital_bucks(id) on delete cascade,
  original_path text not null unique,
  web_path text unique,
  print_path text unique,
  original_name text not null,
  original_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  error_message text,
  is_highlight boolean not null default false,
  display_order integer not null default 0,
  alt_text text not null default '',
  created_at timestamptz not null default now(),
  check (status <> 'ready' or (web_path is not null and print_path is not null))
);
create unique index digital_buck_one_highlight on public.digital_buck_images (buck_id) where is_highlight;
create index digital_bucks_book_order on public.digital_bucks (book_id, display_order, created_at);
create index digital_buck_images_buck_order on public.digital_buck_images (buck_id, display_order, created_at);

create trigger digital_buck_books_updated_at before update on public.digital_buck_books
for each row execute function public.set_current_timestamp_updated_at();

alter table public.digital_buck_books enable row level security;
alter table public.digital_bucks enable row level security;
alter table public.digital_buck_images enable row level security;

create policy "admins manage digital books" on public.digital_buck_books
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage digital bucks" on public.digital_bucks
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage digital buck images" on public.digital_buck_images
for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values ('digital-buck-originals', 'digital-buck-originals', false, 52428800),
       ('digital-buck-web', 'digital-buck-web', false, 52428800),
       ('digital-buck-print', 'digital-buck-print', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "admins upload digital buck assets" on storage.objects
for insert to authenticated with check (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print') and public.is_admin()
);
create policy "admins change digital buck assets" on storage.objects
for update to authenticated using (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print') and public.is_admin()
) with check (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print') and public.is_admin()
);
create policy "admins delete digital buck assets" on storage.objects
for delete to authenticated using (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print') and public.is_admin()
);
create policy "admins read digital buck assets" on storage.objects
for select to authenticated using (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print') and public.is_admin()
);
create or replace function public.is_published_digital_buck_web_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.digital_buck_images i
    join public.digital_bucks buck on buck.id = i.buck_id
    join public.digital_buck_books book on book.id = buck.book_id
    where i.web_path = p_path and i.status = 'ready'
      and buck.print_selected and book.status = 'published'
  );
$$;
revoke all on function public.is_published_digital_buck_web_path(text) from public;
grant execute on function public.is_published_digital_buck_web_path(text) to anon, authenticated;
create policy "published digital buck web images" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'digital-buck-web' and public.is_published_digital_buck_web_path(name)
);

-- Definer functions return only the public presentation fields and opaque IDs.
-- They never return original or private storage paths.
create or replace function public.get_published_digital_book(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id', book.id, 'token', book.public_token, 'year', book.survey_year,
    'propertyName', account.property_name,
    'bucks', coalesce((select jsonb_agg(jsonb_build_object(
      'id', buck.id, 'name', buck.name, 'ageClass', buck.age_class,
      'observations', buck.observations,
      'images', coalesce((select jsonb_agg(jsonb_build_object(
        'id', image.id, 'altText', image.alt_text, 'isHighlight', image.is_highlight
      ) order by image.is_highlight desc, image.display_order, image.created_at)
      from public.digital_buck_images image where image.buck_id = buck.id and image.status = 'ready'), '[]'::jsonb)
    ) order by buck.display_order, buck.created_at)
    from public.digital_bucks buck where buck.book_id = book.id and buck.print_selected), '[]'::jsonb)
  ) into result
  from public.digital_buck_books book
  join public.client_accounts account on account.id = book.client_account_id
  where book.public_token = p_token and book.status = 'published';
  return result;
end;
$$;
revoke all on function public.get_published_digital_book(uuid) from public;
grant execute on function public.get_published_digital_book(uuid) to anon, authenticated;

create or replace function public.get_digital_book_image_path(p_token uuid, p_image_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select image.web_path from public.digital_buck_images image
  join public.digital_bucks buck on buck.id = image.buck_id
  join public.digital_buck_books book on book.id = buck.book_id
  where book.public_token = p_token and book.status = 'published'
    and buck.print_selected and image.id = p_image_id and image.status = 'ready'
  limit 1;
$$;
revoke all on function public.get_digital_book_image_path(uuid, uuid) from public;
grant execute on function public.get_digital_book_image_path(uuid, uuid) to anon, authenticated;

create or replace function public.get_client_digital_books(p_client_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.is_admin() or exists (select 1 from public.client_memberships m
      where m.user_id = auth.uid() and m.client_account_id = p_client_id)
  ) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('token', b.public_token,
    'year', b.survey_year, 'id', b.id)) from public.digital_buck_books b
    where b.client_account_id = p_client_id and b.status = 'published'), '[]'::jsonb);
end;
$$;
revoke all on function public.get_client_digital_books(uuid) from public;
grant execute on function public.get_client_digital_books(uuid) to authenticated;

create or replace function public.set_digital_buck_highlight(p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_buck uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select buck_id into target_buck from public.digital_buck_images
  where id = p_image_id and status = 'ready';
  if target_buck is null then raise exception 'Ready image not found'; end if;
  update public.digital_buck_images set is_highlight = false where buck_id = target_buck and is_highlight;
  update public.digital_buck_images set is_highlight = true where id = p_image_id;
end;
$$;
revoke all on function public.set_digital_buck_highlight(uuid) from public;
grant execute on function public.set_digital_buck_highlight(uuid) to authenticated;
