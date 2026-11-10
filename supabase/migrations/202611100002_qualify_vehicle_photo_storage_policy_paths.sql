-- Qualify the outer storage.objects.name inside dealership EXISTS subqueries.
drop policy if exists "Dealers read own vehicle photos" on storage.objects;
create policy "Dealers read own vehicle photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1 from public.dealerships d
    where d.id::text = (storage.foldername(objects.name))[1]
      and d.user_id = auth.uid()
  )
);

drop policy if exists "Dealers update own vehicle photos" on storage.objects;
create policy "Dealers update own vehicle photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1 from public.dealerships d
    where d.id::text = (storage.foldername(objects.name))[1]
      and d.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1 from public.dealerships d
    where d.id::text = (storage.foldername(objects.name))[1]
      and d.user_id = auth.uid()
  )
);

drop policy if exists "Dealers delete own vehicle photos" on storage.objects;
create policy "Dealers delete own vehicle photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1 from public.dealerships d
    where d.id::text = (storage.foldername(objects.name))[1]
      and d.user_id = auth.uid()
  )
);
