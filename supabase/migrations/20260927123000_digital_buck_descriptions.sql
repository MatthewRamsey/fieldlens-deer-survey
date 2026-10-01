alter table public.digital_bucks
  add column description text not null default '' check (length(description) <= 5000);

alter table public.digital_buck_images
  add column caption text not null default '' check (length(caption) <= 500);

create or replace function public.get_published_digital_book(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id', book.id, 'token', book.public_token, 'year', book.survey_year,
    'propertyName', account.property_name,
    'bucks', coalesce((select jsonb_agg(jsonb_build_object(
      'id', buck.id, 'name', buck.name, 'ageClass', buck.age_class,
      'description', buck.description, 'observations', buck.observations,
      'images', coalesce((select jsonb_agg(jsonb_build_object(
        'id', image.id, 'altText', image.alt_text, 'caption', image.caption,
        'isHighlight', image.is_highlight
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
