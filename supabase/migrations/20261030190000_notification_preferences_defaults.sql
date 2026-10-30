-- Default notification preferences for new and existing dealerships.
drop policy if exists "Dealership owners insert notification events" on public.notification_events;
create policy "Dealership owners insert notification events" on public.notification_events for insert to authenticated
with check (exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())));
create or replace function public.create_notification_preferences_for_dealership()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
 insert into public.notification_preferences(dealership_id) values(new.id) on conflict(dealership_id) do nothing;
 return new;
end;
$$;
drop trigger if exists dealership_notification_preferences on public.dealerships;
create trigger dealership_notification_preferences after insert on public.dealerships for each row execute function public.create_notification_preferences_for_dealership();
revoke all on function public.create_notification_preferences_for_dealership() from public,anon,authenticated;
insert into public.notification_preferences(dealership_id) select id from public.dealerships on conflict(dealership_id) do nothing;