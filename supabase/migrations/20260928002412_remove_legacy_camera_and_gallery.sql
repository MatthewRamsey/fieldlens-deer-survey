-- Digital Buck Book replaces the legacy gallery and camera workflows.
-- A private, verified export of these rows and Storage objects was taken before cutover.
drop policy if exists "admins and members read camera batch image objects" on storage.objects;
drop policy if exists "admins delete camera batch image objects" on storage.objects;
drop policy if exists "admins insert camera batch image objects" on storage.objects;
drop policy if exists "admins manage annual survey photos" on storage.objects;
drop policy if exists "admins manage buck gallery storage" on storage.objects;
drop policy if exists "admins update camera batch image objects" on storage.objects;
drop policy if exists "members read shared buck gallery storage" on storage.objects;
drop policy if exists "admins and members read camera batches" on public.camera_batches;

drop table if exists public.buck_gallery_images;
drop table if exists public.buck_galleries;
drop table if exists public.camera_batch_images;
drop table if exists public.camera_batches;
drop table if exists public.camera_surveys;

drop function if exists public.refresh_camera_batch_counts();
drop function if exists public.save_camera_survey(uuid, text, jsonb, bigint);
drop function if exists public.valid_camera_survey_photos(jsonb);

delete from public.client_documents where category = 'Buck book';
alter table public.client_documents drop constraint if exists client_documents_category_check;
alter table public.client_documents add constraint client_documents_category_check
  check (category in ('Camera survey report', 'Map export', 'Harvest plan'));
