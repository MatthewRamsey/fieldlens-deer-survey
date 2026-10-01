-- Admin role alone does not grant access to every property's book.
create or replace function public.can_manage_digital_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.client_memberships m on m.user_id = p.id
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and m.client_account_id = p_client_id
      and m.membership_role in ('owner', 'manager')
  );
$$;
revoke all on function public.can_manage_digital_client(uuid) from public, anon;
grant execute on function public.can_manage_digital_client(uuid) to authenticated;

drop policy if exists "admins manage digital books" on public.digital_buck_books;
create policy "admins manage digital books" on public.digital_buck_books
for all to authenticated
using (public.can_manage_digital_client(client_account_id))
with check (public.can_manage_digital_client(client_account_id));

drop policy if exists "admins manage digital bucks" on public.digital_bucks;
create policy "admins manage digital bucks" on public.digital_bucks
for all to authenticated
using (exists (
  select 1 from public.digital_buck_books book
  where book.id = digital_bucks.book_id
    and public.can_manage_digital_client(book.client_account_id)
))
with check (exists (
  select 1 from public.digital_buck_books book
  where book.id = digital_bucks.book_id
    and public.can_manage_digital_client(book.client_account_id)
));

drop policy if exists "admins manage digital buck images" on public.digital_buck_images;
create policy "admins manage digital buck images" on public.digital_buck_images
for all to authenticated
using (exists (
  select 1 from public.digital_bucks buck
  join public.digital_buck_books book on book.id = buck.book_id
  where buck.id = digital_buck_images.buck_id
    and public.can_manage_digital_client(book.client_account_id)
))
with check (exists (
  select 1 from public.digital_bucks buck
  join public.digital_buck_books book on book.id = buck.book_id
  where buck.id = digital_buck_images.buck_id
    and public.can_manage_digital_client(book.client_account_id)
));

drop policy if exists "admins upload digital buck assets" on storage.objects;
create policy "admins upload digital buck assets" on storage.objects
for insert to authenticated with check (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print')
  and exists (select 1 from public.digital_buck_books book
    where book.id::text = split_part(name, '/', 1)
      and public.can_manage_digital_client(book.client_account_id))
);

drop policy if exists "admins change digital buck assets" on storage.objects;
create policy "admins change digital buck assets" on storage.objects
for update to authenticated
using (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print')
  and exists (select 1 from public.digital_buck_books book
    where book.id::text = split_part(name, '/', 1)
      and public.can_manage_digital_client(book.client_account_id))
)
with check (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print')
  and exists (select 1 from public.digital_buck_books book
    where book.id::text = split_part(name, '/', 1)
      and public.can_manage_digital_client(book.client_account_id))
);

drop policy if exists "admins delete digital buck assets" on storage.objects;
create policy "admins delete digital buck assets" on storage.objects
for delete to authenticated using (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print')
  and exists (select 1 from public.digital_buck_books book
    where book.id::text = split_part(name, '/', 1)
      and public.can_manage_digital_client(book.client_account_id))
);

drop policy if exists "admins read digital buck assets" on storage.objects;
create policy "admins read digital buck assets" on storage.objects
for select to authenticated using (
  bucket_id in ('digital-buck-originals', 'digital-buck-web', 'digital-buck-print')
  and exists (select 1 from public.digital_buck_books book
    where book.id::text = split_part(name, '/', 1)
      and public.can_manage_digital_client(book.client_account_id))
);

create or replace function public.get_client_digital_books(p_client_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.client_memberships m
    where m.user_id = auth.uid() and m.client_account_id = p_client_id
  ) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('token', b.public_token,
    'year', b.survey_year, 'id', b.id)) from public.digital_buck_books b
    where b.client_account_id = p_client_id and b.status = 'published'), '[]'::jsonb);
end;
$$;

create or replace function public.set_digital_buck_highlight(p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_buck uuid;
begin
  select image.buck_id into target_buck
  from public.digital_buck_images image
  join public.digital_bucks buck on buck.id = image.buck_id
  join public.digital_buck_books book on book.id = buck.book_id
  where image.id = p_image_id and image.status = 'ready'
    and public.can_manage_digital_client(book.client_account_id);
  if target_buck is null then raise exception 'Ready image not found for this administrator'; end if;
  update public.digital_buck_images set is_highlight = false
    where buck_id = target_buck and is_highlight;
  update public.digital_buck_images set is_highlight = true where id = p_image_id;
end;
$$;
