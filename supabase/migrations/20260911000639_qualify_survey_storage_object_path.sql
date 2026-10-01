drop policy "admins manage annual survey photos" on storage.objects;
create policy "admins manage annual survey photos" on storage.objects
for all to authenticated
using (bucket_id = 'camera-survey-photos' and (select public.is_admin()))
with check (
  bucket_id = 'camera-survey-photos' and (select public.is_admin())
  and (storage.foldername(storage.objects.name))[2] ~ '^20[0-9]{2}$'
  and exists (select 1 from public.client_accounts where id::text = (storage.foldername(storage.objects.name))[1] and is_active)
);
