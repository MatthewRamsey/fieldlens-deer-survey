-- A serialization-failure SQLSTATE makes PostgREST retry until the client times
-- out. Return an explicit conflict response so the UI can immediately ask the
-- admin to reload instead of appearing to hang.
create or replace function public.save_camera_survey(
  p_client_id uuid,
  p_year text,
  p_data jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare saved_revision bigint;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_expected_revision < 0 or p_expected_revision is null then
    raise exception 'Invalid revision';
  end if;

  if p_expected_revision = 0 then
    insert into public.camera_surveys(client_account_id, survey_year, data)
    values (p_client_id, p_year, p_data)
    on conflict do nothing
    returning revision into saved_revision;
  else
    update public.camera_surveys
    set data = p_data,
        revision = revision + 1,
        updated_at = now()
    where client_account_id = p_client_id
      and survey_year = p_year
      and revision = p_expected_revision
    returning revision into saved_revision;
  end if;

  if saved_revision is null then
    raise exception 'This survey changed in another session. Export your unsaved details, then reload before continuing.'
      using errcode = 'PT409';
  end if;

  return saved_revision;
end;
$$;
