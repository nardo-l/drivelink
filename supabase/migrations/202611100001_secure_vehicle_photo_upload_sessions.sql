-- Secure vehicle photo uploads using the upload-session UUID in the object path.
-- Expected object path: {dealership_id}/vehicles/{session_id}/{filename}

create or replace function private.vehicle_photo_upload_session_valid(
  p_dealership_id text,
  p_session_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    auth.uid() is not null
    and p_dealership_id is not null
    and p_session_id is not null
    and exists (
      select 1
      from public.vehicle_photo_upload_sessions s
      where s.id::text = p_session_id
        and s.dealership_id::text = p_dealership_id
        and s.user_id = auth.uid()
        and s.created_at >= now() - interval '24 hours'
    );
$function$;

revoke all on function private.vehicle_photo_upload_session_valid(text, text) from public;
grant usage on schema private to authenticated;
grant execute on function private.vehicle_photo_upload_session_valid(text, text) to authenticated;

drop policy if exists "Dealers upload own vehicle photos" on storage.objects;
create policy "Dealers upload own vehicle photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vehicle-photos'
  and (storage.foldername(name))[2] = 'vehicles'
  and private.vehicle_photo_upload_session_valid(
    (storage.foldername(name))[1],
    (storage.foldername(name))[3]
  )
);

drop policy if exists "Dealers read own vehicle photos" on storage.objects;
create policy "Dealers read own vehicle photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1 from public.dealerships d
    where d.id::text = (storage.foldername(name))[1]
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
    where d.id::text = (storage.foldername(name))[1]
      and d.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1 from public.dealerships d
    where d.id::text = (storage.foldername(name))[1]
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
    where d.id::text = (storage.foldername(name))[1]
      and d.user_id = auth.uid()
  )
);

revoke all on function public.create_vehicle_photo_session(uuid) from public, anon;
grant execute on function public.create_vehicle_photo_session(uuid) to authenticated;
