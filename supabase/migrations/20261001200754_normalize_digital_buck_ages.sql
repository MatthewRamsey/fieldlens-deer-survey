-- Convert historical 1.5–5.5+ labels to the five whole-year groups.
update public.digital_bucks
set age_class = case
  when lower(trim(age_class)) ~ '^[1-5](\.5)?[+]?([[:space:]]*(years?|yrs?)([[:space:]]*old)?)?$'
    then left(trim(age_class), 1)
  else ''
end
where age_class not in ('', '1', '2', '3', '4', '5');

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
  if p_age_class is null or p_age_class not in ('1', '2', '3', '4', '5') then
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
