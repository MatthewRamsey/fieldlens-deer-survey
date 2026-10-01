create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts (id) on delete cascade,
  title text not null,
  category text not null check (category in ('Camera survey report', 'Buck book', 'Map export', 'Harvest plan')),
  survey_year text not null,
  file_path text not null unique,
  file_type text not null,
  page_count integer,
  visibility text not null default 'client' check (visibility in ('admin', 'client')),
  status text not null default 'published' check (status in ('draft', 'published')),
  notes text not null default '',
  upload_source text not null default 'Desktop upload' check (upload_source in ('Desktop upload', 'Google Drive')),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.buck_galleries (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts (id) on delete cascade,
  slug text not null,
  name text not null,
  buck_name text not null,
  classification text not null check (classification in ('Trophy buck', 'Management buck')),
  survey_year text not null,
  image_count integer not null default 0 check (image_count >= 0),
  source text not null default 'Manual upload' check (source in ('SD card', 'Google Drive', 'Manual upload')),
  visibility text not null default 'client' check (visibility in ('admin', 'client')),
  qr_enabled boolean not null default true,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (client_account_id, survey_year, slug)
);

create table if not exists public.buck_gallery_images (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.buck_galleries (id) on delete cascade,
  client_account_id uuid not null references public.client_accounts (id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  caption text,
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_client_documents_updated_at on public.client_documents;
create trigger set_client_documents_updated_at
before update on public.client_documents
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_buck_galleries_updated_at on public.buck_galleries;
create trigger set_buck_galleries_updated_at
before update on public.buck_galleries
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.client_documents enable row level security;
alter table public.buck_galleries enable row level security;
alter table public.buck_gallery_images enable row level security;

drop policy if exists "admins manage client documents" on public.client_documents;
create policy "admins manage client documents"
on public.client_documents
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members read published client documents" on public.client_documents;
create policy "members read published client documents"
on public.client_documents
for select
to authenticated
using (
  public.is_admin()
  or (
    visibility = 'client'
    and status = 'published'
    and exists (
      select 1
      from public.client_memberships memberships
      where memberships.client_account_id = client_documents.client_account_id
        and memberships.user_id = auth.uid()
    )
  )
);

drop policy if exists "admins manage buck galleries" on public.buck_galleries;
create policy "admins manage buck galleries"
on public.buck_galleries
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members read published buck galleries" on public.buck_galleries;
create policy "members read published buck galleries"
on public.buck_galleries
for select
to authenticated
using (
  public.is_admin()
  or (
    visibility = 'client'
    and exists (
      select 1
      from public.client_memberships memberships
      where memberships.client_account_id = buck_galleries.client_account_id
        and memberships.user_id = auth.uid()
    )
  )
);

drop policy if exists "admins manage buck gallery images" on public.buck_gallery_images;
create policy "admins manage buck gallery images"
on public.buck_gallery_images
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members read published buck gallery images" on public.buck_gallery_images;
create policy "members read published buck gallery images"
on public.buck_gallery_images
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.buck_galleries galleries
    join public.client_memberships memberships
      on memberships.client_account_id = galleries.client_account_id
    where galleries.id = buck_gallery_images.gallery_id
      and galleries.visibility = 'client'
      and memberships.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.client_documents to authenticated;
grant select, insert, update, delete on public.buck_galleries to authenticated;
grant select, insert, update, delete on public.buck_gallery_images to authenticated;

insert into storage.buckets (id, name, public)
values
  ('client-documents', 'client-documents', false),
  ('buck-gallery-images', 'buck-gallery-images', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "admins manage client document objects" on storage.objects;
create policy "admins manage client document objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'client-documents'
  and public.is_admin()
)
with check (
  bucket_id = 'client-documents'
  and public.is_admin()
);

drop policy if exists "members read published client document objects" on storage.objects;
create policy "members read published client document objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.client_documents documents
      join public.client_memberships memberships
        on memberships.client_account_id = documents.client_account_id
      where documents.file_path = storage.objects.name
        and documents.visibility = 'client'
        and documents.status = 'published'
        and memberships.user_id = auth.uid()
    )
  )
);

drop policy if exists "admins manage buck gallery image objects" on storage.objects;
create policy "admins manage buck gallery image objects"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'buck-gallery-images'
  and public.is_admin()
)
with check (
  bucket_id = 'buck-gallery-images'
  and public.is_admin()
);

drop policy if exists "members read published buck gallery image objects" on storage.objects;
create policy "members read published buck gallery image objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'buck-gallery-images'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.buck_gallery_images images
      join public.buck_galleries galleries
        on galleries.id = images.gallery_id
      join public.client_memberships memberships
        on memberships.client_account_id = galleries.client_account_id
      where images.file_path = storage.objects.name
        and galleries.visibility = 'client'
        and memberships.user_id = auth.uid()
    )
  )
);
