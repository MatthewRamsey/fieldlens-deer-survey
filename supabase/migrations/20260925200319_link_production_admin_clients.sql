-- Convert the four legacy production clients from global-admin visibility to
-- explicit ownership by the two established production administrator accounts.
-- QA fixtures remain isolated from production administrators.
insert into public.client_memberships (user_id, client_account_id, membership_role)
select profiles.id, accounts.id, 'owner'::public.membership_role
from public.profiles profiles
cross join public.client_accounts accounts
where profiles.role = 'admin'
  and profiles.email in (
    'ramsey.matthew.a@gmail.com',
    'uplandwildlifemanagement@gmail.com'
  )
  and accounts.slug in (
    'cedar-ridge',
    'long-creek',
    'oak-run-preserve',
    'pine-hollow'
  )
on conflict (user_id, client_account_id) do update
set membership_role = 'owner'::public.membership_role;
