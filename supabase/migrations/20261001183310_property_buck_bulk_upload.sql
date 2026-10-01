-- Keep buck labels stable when their age group or the property display name changes.
alter table public.client_accounts
  add column buck_prefix text,
  add column buck_next_number integer not null default 1 check (buck_next_number > 0);

update public.client_accounts account
set buck_prefix = coalesce(nullif((
  select string_agg(upper(left(part, 1)), '' order by ord)
  from regexp_split_to_table(account.property_name, '[^A-Za-z]+') with ordinality as words(part, ord)
  where part <> ''
), ''), 'P' || upper(left(replace(account.id::text, '-', ''), 6)));

alter table public.client_accounts
  alter column buck_prefix set not null,
  add constraint client_buck_prefix_format check (buck_prefix ~ '^[A-Z0-9]+$');

create or replace function public.set_client_buck_prefix()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.buck_prefix is distinct from old.buck_prefix then
      raise exception 'Buck prefix cannot be changed';
    end if;
    return new;
  end if;
  new.buck_prefix := coalesce(nullif((
    select string_agg(upper(left(part, 1)), '' order by ord)
    from regexp_split_to_table(new.property_name, '[^A-Za-z]+') with ordinality as words(part, ord)
    where part <> ''
  ), ''), 'P' || upper(left(replace(new.id::text, '-', ''), 6)));
  return new;
end;
$$;
create trigger client_buck_prefix_insert before insert on public.client_accounts
for each row execute function public.set_client_buck_prefix();
create trigger client_buck_prefix_immutable before update of buck_prefix on public.client_accounts
for each row execute function public.set_client_buck_prefix();
revoke all on function public.set_client_buck_prefix() from public, anon, authenticated;

alter table public.digital_bucks
  add column client_account_id uuid references public.client_accounts(id) on delete cascade,
  add column buck_number integer,
  add column nickname text not null default '' check (length(nickname) <= 120),
  add column upload_key uuid unique;

-- Existing names become optional nicknames so recognizable labels survive the cutover.
with numbered as (
  select buck.id, book.client_account_id, account.buck_prefix,
    row_number() over (partition by book.client_account_id
      order by book.survey_year, buck.display_order, buck.created_at, buck.id) as number
  from public.digital_bucks buck
  join public.digital_buck_books book on book.id = buck.book_id
  join public.client_accounts account on account.id = book.client_account_id
)
update public.digital_bucks buck
set client_account_id = numbered.client_account_id,
    buck_number = numbered.number,
    nickname = buck.name,
    name = numbered.buck_prefix || numbered.number::text
from numbered where buck.id = numbered.id;

update public.client_accounts account
set buck_next_number = coalesce((
  select max(buck.buck_number) + 1 from public.digital_bucks buck
  where buck.client_account_id = account.id
), 1);
