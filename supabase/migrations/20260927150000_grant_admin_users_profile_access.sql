-- The admin-users Edge Function checks the actor's profile and updates account details
-- through the service-role client. Grant only the columns it reads or changes.
grant select (id, role, email) on public.profiles to service_role;
grant update (email, full_name) on public.profiles to service_role;
