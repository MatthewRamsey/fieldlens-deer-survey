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

alter table public.digital_bucks
  alter column client_account_id set not null,
  alter column buck_number set not null,
  add constraint digital_buck_number_positive check (buck_number > 0),
  add constraint digital_buck_property_number_unique unique (client_account_id, buck_number);

-- New buck records are created only through the authorized allocator below.
revoke insert on public.digital_bucks from authenticated;

-- A buck's denormalized property must always match its book.
alter table public.digital_buck_books add constraint digital_book_id_client_unique unique (id, client_account_id);
alter table public.digital_bucks add constraint digital_buck_book_client_fk
  foreign key (book_id, client_account_id)
  references public.digital_buck_books (id, client_account_id) on delete cascade;

create or replace function public.create_digital_buck_for_photo(
  p_book_id uuid, p_age_class text, p_upload_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_account_id uuid;
  v_status text;
  v_prefix text;
  v_number integer;
  v_order integer;
  v_existing public.digital_bucks%rowtype;
  v_created public.digital_bucks%rowtype;
begin
  if p_upload_key is null then raise exception 'Upload key required'; end if;
  if p_age_class is null or p_age_class !~ '^[0-9]+(\.[0-9]+)?\+?$' or length(p_age_class) > 80 then
    raise exception 'Choose a valid age group';
  end if;
  select book.client_account_id, book.status into v_account_id, v_status
  from public.digital_buck_books book where book.id = p_book_id;
  if v_account_id is null or not public.can_manage_digital_client(v_account_id) then
    raise exception 'Buck book not found for this administrator';
  end if;
  -- Lock the property row so all its years and age groups share one sequence.
  select account.buck_prefix, account.buck_next_number into v_prefix, v_number
  from public.client_accounts account where account.id = v_account_id for update;
  select * into v_existing from public.digital_bucks where upload_key = p_upload_key;
  if found then
    if v_existing.book_id <> p_book_id or v_existing.age_class <> p_age_class then
      raise exception 'Upload key already belongs to a different buck';
    end if;
    return jsonb_build_object('id', v_existing.id, 'name', v_existing.name, 'created', false,
      'ready', exists (select 1 from public.digital_buck_images image
        where image.buck_id = v_existing.id and image.is_highlight and image.status = 'ready'),
      'highlightId', (select image.id from public.digital_buck_images image
        where image.buck_id = v_existing.id and image.is_highlight and image.status = 'ready' limit 1));
  end if;
  select coalesce(max(display_order) + 1, 0) into v_order
  from public.digital_bucks where book_id = p_book_id;
  insert into public.digital_bucks (
    book_id, client_account_id, buck_number, name, age_class,
    print_selected, display_order, upload_key
  ) values (
    p_book_id, v_account_id, v_number, v_prefix || v_number::text, p_age_class,
    v_status <> 'published', v_order, p_upload_key
  ) returning * into v_created;
  update public.client_accounts set buck_next_number = v_number + 1 where id = v_account_id;
  return jsonb_build_object('id', v_created.id, 'name', v_created.name, 'created', true,
    'ready', false, 'highlightId', null);
end;
$$;
revoke all on function public.create_digital_buck_for_photo(uuid, text, uuid) from public, anon;
grant execute on function public.create_digital_buck_for_photo(uuid, text, uuid) to authenticated;

-- Remove old prose from active data, including its columns and public projection.
create or replace function public.get_published_digital_book(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id', book.id, 'token', book.public_token, 'year', book.survey_year,
    'propertyName', account.property_name,
    'bucks', coalesce((select jsonb_agg(jsonb_build_object(
      'id', buck.id,
      'name', buck.name || case when buck.nickname = '' then '' else ' (' || buck.nickname || ')' end,
      'ageClass', buck.age_class,
      'images', coalesce((select jsonb_agg(jsonb_build_object(
        'id', image.id, 'altText', image.alt_text, 'isHighlight', image.is_highlight
      ) order by image.is_highlight desc, image.display_order, image.created_at)
      from public.digital_buck_images image where image.buck_id = buck.id and image.status = 'ready'), '[]'::jsonb)
    ) order by buck.display_order, buck.created_at)
    from public.digital_bucks buck where buck.book_id = book.id and buck.print_selected), '[]'::jsonb)
  ) into result
  from public.digital_buck_books book
  join public.client_accounts account on account.id = book.client_account_id
  where book.public_token = p_token and book.status = 'published';
  return result;
end;
$$;
revoke all on function public.get_published_digital_book(uuid) from public;
grant execute on function public.get_published_digital_book(uuid) to anon, authenticated;

alter table public.digital_bucks drop column observations, drop column description;
alter table public.digital_buck_images drop column caption;
