-- Preserve a supplied prefix on new properties; otherwise keep the existing initials convention.
create or replace function public.set_client_buck_prefix()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.buck_prefix is distinct from old.buck_prefix then
      raise exception 'Buck prefix cannot be changed';
    end if;
    return new;
  end if;

  if nullif(btrim(new.buck_prefix), '') is not null then
    new.buck_prefix := upper(btrim(new.buck_prefix));
    if new.buck_prefix !~ '^[A-Z0-9]{1,12}$' then
      raise exception 'Buck prefix must be 1–12 letters or numbers';
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
revoke all on function public.set_client_buck_prefix() from public, anon, authenticated;
