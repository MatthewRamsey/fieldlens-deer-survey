create or replace function public.validate_published_digital_book()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_book uuid;
begin
  if tg_table_name = 'digital_buck_books' then
    if tg_op = 'DELETE' then target_book := old.id; else target_book := new.id; end if;
  elsif tg_table_name = 'digital_bucks' then
    if tg_op = 'DELETE' then target_book := old.book_id; else target_book := new.book_id; end if;
  else
    if tg_op = 'DELETE' then
      select book_id into target_book from public.digital_bucks where id = old.buck_id;
    else
      select book_id into target_book from public.digital_bucks where id = new.buck_id;
    end if;
  end if;
  if target_book is null or not exists (
    select 1 from public.digital_buck_books where id = target_book and status = 'published'
  ) then return null; end if;
  if not exists (select 1 from public.digital_bucks where book_id = target_book and print_selected) then
    raise exception 'A published digital buck book needs at least one selected buck.';
  end if;
  if exists (
    select 1 from public.digital_bucks buck
    where buck.book_id = target_book and buck.print_selected
      and not exists (select 1 from public.digital_buck_images image
        where image.buck_id = buck.id and image.status = 'ready' and image.is_highlight)
  ) then raise exception 'Every selected buck in a published book needs a ready highlight.'; end if;
  return null;
end;
$$;
revoke all on function public.validate_published_digital_book() from public, anon, authenticated;

create constraint trigger check_digital_book_publication
after insert or update or delete on public.digital_buck_books deferrable initially deferred
for each row execute function public.validate_published_digital_book();
create constraint trigger check_digital_buck_publication
after insert or update or delete on public.digital_bucks deferrable initially deferred
for each row execute function public.validate_published_digital_book();
create constraint trigger check_digital_buck_image_publication
after insert or update or delete on public.digital_buck_images deferrable initially deferred
for each row execute function public.validate_published_digital_book();
