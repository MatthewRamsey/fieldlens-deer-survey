-- Annual counting snapshots are separate from curated, client-visible buck galleries.
create function public.valid_camera_survey_photos(photos jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare photo jsonb; category text;
begin
  if jsonb_typeof(photos) <> 'array' then return false; end if;
  for photo in select value from jsonb_array_elements(photos) loop
    if jsonb_typeof(photo) <> 'object'
      or coalesce(photo->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(photo->'name') is distinct from 'string'
      or jsonb_typeof(photo->'cameraId') is distinct from 'string'
      or jsonb_typeof(photo->'notes') is distinct from 'string'
      or jsonb_typeof(photo->'capturedAt') is distinct from 'string'
      or jsonb_typeof(photo->'reviewed') is distinct from 'boolean'
      or jsonb_typeof(photo->'counts') is distinct from 'object'
    then return false; end if;
    foreach category in array array['bucks','does','fawns'] loop
      if jsonb_typeof(photo->'counts'->category) is distinct from 'number'
        or coalesce(photo->'counts'->>category,'') !~ '^[0-9]{1,9}$'
      then return false; end if;
    end loop;
  end loop;
  return (select count(*) = count(distinct value->>'id') from jsonb_array_elements(photos));
end;
$$;
revoke all on function public.valid_camera_survey_photos(jsonb) from public, anon;
grant execute on function public.valid_camera_survey_photos(jsonb) to authenticated;

create table public.camera_surveys (
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  survey_year text not null check (survey_year ~ '^20[0-9]{2}$'),
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data->'notes') = 'string'
    and jsonb_typeof(data->'keyMap') = 'object'
    and jsonb_typeof(data->'currentPhotoId') = 'string'
    and data ?& array['photos','notes','keyMap','currentPhotoId']
    and public.valid_camera_survey_photos(data->'photos')
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (client_account_id, survey_year)
);
alter table public.camera_surveys enable row level security;
grant select, insert, update on public.camera_surveys to authenticated;
create policy "admins manage annual camera surveys" on public.camera_surveys
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Compare revisions atomically to avoid one browser overwriting another admin's work.
create function public.save_camera_survey(p_client_id uuid, p_year text, p_data jsonb, p_expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare saved_revision bigint;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_expected_revision < 0 or p_expected_revision is null then raise exception 'Invalid revision'; end if;
  if p_expected_revision = 0 then
    insert into public.camera_surveys(client_account_id, survey_year, data)
    values (p_client_id, p_year, p_data)
    on conflict do nothing returning revision into saved_revision;
  else
    update public.camera_surveys set data = p_data, revision = revision + 1, updated_at = now()
    where client_account_id = p_client_id and survey_year = p_year and revision = p_expected_revision
    returning revision into saved_revision;
  end if;
  if saved_revision is null then raise exception 'This survey changed in another session. Export your unsaved details, then reload before continuing.' using errcode = '40001'; end if;
  return saved_revision;
end;
$$;
revoke all on function public.save_camera_survey(uuid,text,jsonb,bigint) from public, anon;
grant execute on function public.save_camera_survey(uuid,text,jsonb,bigint) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('camera-survey-photos', 'camera-survey-photos', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/avif']);
create policy "admins manage annual survey photos" on storage.objects
for all to authenticated
using (bucket_id = 'camera-survey-photos' and (select public.is_admin()))
with check (
  bucket_id = 'camera-survey-photos' and (select public.is_admin())
  and (storage.foldername(name))[2] ~ '^20[0-9]{2}$'
  and exists (select 1 from public.client_accounts where id::text = (storage.foldername(name))[1] and is_active)
);
