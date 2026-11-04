drop policy if exists "Dealers view own showroom branding" on storage.objects;
create policy "Dealers view own showroom branding"
on storage.objects for select to authenticated
using (
  bucket_id = 'dealership-branding'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
