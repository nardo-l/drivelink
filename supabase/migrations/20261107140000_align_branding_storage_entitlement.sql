-- Align every dealership-owned upload bucket with the same entitlement predicate.
-- The existing canonical application status is 'trial'; 'trialing' is accepted
-- as a compatibility alias. Active paid access is bounded by current_period_end.
create or replace function private.dealership_has_write_access(p_dealership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.dealerships d
    join public.dealership_subscriptions s on s.dealership_id = d.id
    where d.id = p_dealership_id
      and d.user_id = (select auth.uid())
      and (
        (s.status in ('trial', 'trialing') and s.trial_ends_at > pg_catalog.now())
        or (s.status = 'active' and s.current_period_end > pg_catalog.now())
      )
  );
$function$;

-- Branding is staged before the dealership row exists during onboarding.
-- Permit only the signed-in user's exact logo/banner staging keys in that
-- pre-dealership state. Once a dealership exists, entitlement is mandatory.
drop policy if exists "Dealers upload own showroom branding" on storage.objects;
create policy "Dealers upload own showroom branding"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'dealership-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    exists (
      select 1 from public.dealerships d
      where d.user_id = (select auth.uid())
        and private.dealership_has_write_access(d.id)
    )
    or (
      not exists (
        select 1 from public.dealerships d
        where d.user_id = (select auth.uid())
      )
      and name in (
        (select auth.uid())::text || '/logo.webp',
        (select auth.uid())::text || '/banner.webp'
      )
    )
  )
);

drop policy if exists "Dealers update own showroom branding" on storage.objects;
create policy "Dealers update own showroom branding"
on storage.objects for update to authenticated
using (
  bucket_id = 'dealership-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    exists (
      select 1 from public.dealerships d
      where d.user_id = (select auth.uid())
        and private.dealership_has_write_access(d.id)
    )
    or (
      not exists (
        select 1 from public.dealerships d
        where d.user_id = (select auth.uid())
      )
      and name in (
        (select auth.uid())::text || '/logo.webp',
        (select auth.uid())::text || '/banner.webp'
      )
    )
  )
)
with check (
  bucket_id = 'dealership-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    exists (
      select 1 from public.dealerships d
      where d.user_id = (select auth.uid())
        and private.dealership_has_write_access(d.id)
    )
    or (
      not exists (
        select 1 from public.dealerships d
        where d.user_id = (select auth.uid())
      )
      and name in (
        (select auth.uid())::text || '/logo.webp',
        (select auth.uid())::text || '/banner.webp'
      )
    )
  )
);

drop policy if exists "Dealers delete own showroom branding" on storage.objects;
create policy "Dealers delete own showroom branding"
on storage.objects for delete to authenticated
using (
  bucket_id = 'dealership-branding'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    exists (
      select 1 from public.dealerships d
      where d.user_id = (select auth.uid())
        and private.dealership_has_write_access(d.id)
    )
    or (
      not exists (
        select 1 from public.dealerships d
        where d.user_id = (select auth.uid())
      )
      and name in (
        (select auth.uid())::text || '/logo.webp',
        (select auth.uid())::text || '/banner.webp',
        (select auth.uid())::text || '/banner-og.webp'
      )
    )
  )
);
