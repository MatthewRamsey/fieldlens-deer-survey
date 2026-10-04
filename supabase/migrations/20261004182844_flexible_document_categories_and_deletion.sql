-- Preserve existing labels while allowing administrators to name new document categories.
alter table public.client_documents drop constraint if exists client_documents_category_check;
alter table public.client_documents add constraint client_documents_category_check
  check (char_length(category) between 1 and 100 and category = btrim(category) and category !~ '[[:cntrl:]]');

-- A tombstone hides a document while its private Storage object is being removed.
alter table public.client_documents add column deleted_at timestamptz;

drop policy if exists "members read published client documents" on public.client_documents;
create policy "members read published client documents" on public.client_documents
for select to authenticated using (
  public.is_admin() or (
    deleted_at is null and visibility = 'client' and status = 'published'
    and exists (
      select 1 from public.client_memberships memberships
      where memberships.client_account_id = client_documents.client_account_id
        and memberships.user_id = auth.uid()
    )
  )
);

drop policy if exists "members read published client document objects" on storage.objects;
create policy "members read published client document objects" on storage.objects
for select to authenticated using (
  bucket_id = 'client-documents' and (
    public.is_admin() or exists (
      select 1 from public.client_documents documents
      join public.client_memberships memberships
        on memberships.client_account_id = documents.client_account_id
      where documents.file_path = storage.objects.name
        and documents.deleted_at is null
        and documents.visibility = 'client'
        and documents.status = 'published'
        and memberships.user_id = auth.uid()
    )
  )
);
