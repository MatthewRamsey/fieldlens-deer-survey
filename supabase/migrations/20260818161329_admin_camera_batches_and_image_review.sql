create table if not exists public.camera_batches (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts (id) on delete cascade,
  survey_year text not null,
  camera_name text not null,
  source text not null default 'SD card' check (source in ('SD card', 'Google Drive', 'Manual upload')),
  notes text not null default '',
  image_count integer not null default 0 check (image_count >= 0),
  client_visible_count integer not null default 0 check (client_visible_count >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.camera_batch_images (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.camera_batches (id) on delete cascade,
  client_account_id uuid not null references public.client_accounts (id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  captured_at timestamptz,
  display_order integer not null default 0,
  age_label text not null default 'Unknown' check (
    age_label in ('Unknown', 'Fawn', '1.5 years', '2.5 years', '3.5 years', '4.5 years', '5.5+ years')
  ),
  antler_points integer check (antler_points is null or (antler_points >= 0 and antler_points <= 40)),
  life_status text not null default 'Unknown' check (life_status in ('Unknown', 'Alive', 'Dead')),
  deer_classification text not null default 'Unsorted' check (
    deer_classification in ('Unsorted', 'Management', 'Trophy')
  ),
  client_visible boolean not null default false,
  review_notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists camera_batches_client_account_year_idx
on public.camera_batches (client_account_id, survey_year);

create index if not exists camera_batches_created_by_idx
on public.camera_batches (created_by);

create index if not exists camera_batch_images_batch_id_idx
on public.camera_batch_images (batch_id);

create index if not exists camera_batch_images_client_account_id_idx
on public.camera_batch_images (client_account_id);

create index if not exists camera_batch_images_created_by_idx
on public.camera_batch_images (created_by);

create or replace function public.refresh_camera_batch_counts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_batch_id uuid;
begin
  target_batch_id := coalesce(new.batch_id, old.batch_id);

  update public.camera_batches
  set
    image_count = (
      select count(*)
      from public.camera_batch_images
      where batch_id = target_batch_id
    ),
    client_visible_count = (
      select count(*)
      from public.camera_batch_images
      where batch_id = target_batch_id
        and client_visible
    ),
    updated_at = timezone('utc', now())
  where id = target_batch_id;

  return coalesce(new, old);
end;
$$;
revoke execute on function public.refresh_camera_batch_counts() from public, anon, authenticated;

drop trigger if exists set_camera_batches_updated_at on public.camera_batches;
create trigger set_camera_batches_updated_at
before update on public.camera_batches
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_camera_batch_images_updated_at on public.camera_batch_images;
create trigger set_camera_batch_images_updated_at
before update on public.camera_batch_images
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists refresh_camera_batch_counts_after_insert on public.camera_batch_images;
create trigger refresh_camera_batch_counts_after_insert
after insert on public.camera_batch_images
for each row
execute function public.refresh_camera_batch_counts();

drop trigger if exists refresh_camera_batch_counts_after_update on public.camera_batch_images;
create trigger refresh_camera_batch_counts_after_update
after update of client_visible, batch_id on public.camera_batch_images
for each row
execute function public.refresh_camera_batch_counts();

drop trigger if exists refresh_camera_batch_counts_after_delete on public.camera_batch_images;
create trigger refresh_camera_batch_counts_after_delete
after delete on public.camera_batch_images
for each row
execute function public.refresh_camera_batch_counts();

alter table public.camera_batches enable row level security;
alter table public.camera_batch_images enable row level security;

drop policy if exists "admins manage camera batches" on public.camera_batches;
drop policy if exists "admins insert camera batches" on public.camera_batches;
drop policy if exists "admins update camera batches" on public.camera_batches;
drop policy if exists "admins delete camera batches" on public.camera_batches;
drop policy if exists "admins and members read camera batches" on public.camera_batches;
drop policy if exists "members read client-visible camera batches" on public.camera_batches;

create policy "admins insert camera batches"
on public.camera_batches
for insert
to authenticated
with check (public.is_admin());

create policy "admins update camera batches"
on public.camera_batches
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete camera batches"
on public.camera_batches
for delete
to authenticated
using (public.is_admin());

create policy "admins and members read camera batches"
on public.camera_batches
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.camera_batch_images images
    join public.client_memberships memberships
      on memberships.client_account_id = images.client_account_id
      where images.batch_id = camera_batches.id
        and images.client_visible
        and memberships.user_id = (select auth.uid())
  )
);

drop policy if exists "admins manage camera batch images" on public.camera_batch_images;
drop policy if exists "admins insert camera batch images" on public.camera_batch_images;
drop policy if exists "admins update camera batch images" on public.camera_batch_images;
drop policy if exists "admins delete camera batch images" on public.camera_batch_images;
drop policy if exists "admins and members read camera batch images" on public.camera_batch_images;
drop policy if exists "members read client-visible camera batch images" on public.camera_batch_images;

create policy "admins insert camera batch images"
on public.camera_batch_images
for insert
to authenticated
with check (public.is_admin());

create policy "admins update camera batch images"
on public.camera_batch_images
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete camera batch images"
on public.camera_batch_images
for delete
to authenticated
using (public.is_admin());

create policy "admins and members read camera batch images"
on public.camera_batch_images
for select
to authenticated
using (
  public.is_admin()
  or (
    client_visible
    and exists (
      select 1
      from public.client_memberships memberships
      where memberships.client_account_id = camera_batch_images.client_account_id
        and memberships.user_id = (select auth.uid())
    )
  )
);

grant select, insert, update, delete on public.camera_batches to authenticated;
grant select, insert, update, delete on public.camera_batch_images to authenticated;

insert into storage.buckets (id, name, public)
values ('camera-batch-images', 'camera-batch-images', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "admins manage camera batch image objects" on storage.objects;
drop policy if exists "admins insert camera batch image objects" on storage.objects;
drop policy if exists "admins update camera batch image objects" on storage.objects;
drop policy if exists "admins delete camera batch image objects" on storage.objects;
drop policy if exists "admins and members read camera batch image objects" on storage.objects;
drop policy if exists "members read client-visible camera batch image objects" on storage.objects;

create policy "admins insert camera batch image objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'camera-batch-images'
  and public.is_admin()
);

create policy "admins update camera batch image objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'camera-batch-images'
  and public.is_admin()
)
with check (
  bucket_id = 'camera-batch-images'
  and public.is_admin()
);

create policy "admins delete camera batch image objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'camera-batch-images'
  and public.is_admin()
);

create policy "admins and members read camera batch image objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'camera-batch-images'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.camera_batch_images images
      join public.client_memberships memberships
        on memberships.client_account_id = images.client_account_id
      where images.file_path = storage.objects.name
        and images.client_visible
        and memberships.user_id = (select auth.uid())
    )
  )
);
