-- Storefront view history for real, dated analytics.
-- Historical aggregate counts are intentionally not backfilled because their dates are unknown.

create table if not exists public.storefront_view_events (
  id bigint generated always as identity primary key,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists storefront_view_events_dealership_viewed_at_idx
  on public.storefront_view_events (dealership_id, viewed_at desc);

alter table public.storefront_view_events enable row level security;

drop policy if exists "Dealership owners can read their storefront view history" on public.storefront_view_events;
create policy "Dealership owners can read their storefront view history"
  on public.storefront_view_events for select to authenticated
  using (
    exists (
      select 1 from public.dealerships d
      where d.id = storefront_view_events.dealership_id
        and d.user_id = (select auth.uid())
    )
  );

revoke all on public.storefront_view_events from anon, authenticated;
grant select on public.storefront_view_events to authenticated;

create or replace function public.record_storefront_view(p_slug text)
returns void language plpgsql security definer set search_path to ''
as $function$
declare target_dealership_id uuid;
begin
  update public.dealerships
  set storefront_views = coalesce(storefront_views, 0) + 1
  where slug = p_slug and is_published = true
  returning id into target_dealership_id;

  if target_dealership_id is not null then
    insert into public.storefront_view_events (dealership_id) values (target_dealership_id);
  end if;
end;
$function$;

revoke all on function public.record_storefront_view(text) from public;
grant execute on function public.record_storefront_view(text) to anon, authenticated;

create or replace function public.get_storefront_view_history(p_days integer default 30)
returns table (view_date date, views bigint)
language sql stable security invoker set search_path to ''
as $function$
  select (events.viewed_at at time zone 'Africa/Harare')::date as view_date, count(*)::bigint as views
  from public.storefront_view_events events
  where events.dealership_id in (
    select d.id from public.dealerships d where d.user_id = (select auth.uid())
  )
    and events.viewed_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 90)))
  group by (events.viewed_at at time zone 'Africa/Harare')::date
  order by view_date asc;
$function$;

revoke all on function public.get_storefront_view_history(integer) from public;
grant execute on function public.get_storefront_view_history(integer) to authenticated;
