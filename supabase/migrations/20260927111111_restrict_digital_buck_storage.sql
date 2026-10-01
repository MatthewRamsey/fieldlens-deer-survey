drop policy if exists "published digital buck web images" on storage.objects;
revoke execute on function public.get_digital_book_image_path(uuid, uuid) from anon, authenticated;
revoke execute on function public.is_published_digital_buck_web_path(text) from anon, authenticated;
drop function if exists public.is_published_digital_buck_web_path(text);
