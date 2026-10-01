create or replace function public.can_manage_profile_roles()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or current_user in ('postgres', 'service_role', 'supabase_admin');
$$;
revoke execute on function public.can_manage_profile_roles() from public, anon;
grant execute on function public.can_manage_profile_roles() to authenticated;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.can_manage_profile_roles() then
    raise exception 'Only admins can change profile roles.';
  end if;

  return new;
end;
$$;
revoke execute on function public.prevent_profile_role_escalation() from public, anon, authenticated;
