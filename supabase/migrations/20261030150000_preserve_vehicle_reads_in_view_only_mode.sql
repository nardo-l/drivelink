-- Keep owner inventory readable in view-only mode while blocking mutations.
drop policy if exists subscription_write_vehicles on public.vehicles;
create policy subscription_insert_vehicles on public.vehicles as restrictive
for insert to authenticated with check (public.dealership_has_write_access(dealership_id));
create policy subscription_update_vehicles on public.vehicles as restrictive
for update to authenticated using (public.dealership_has_write_access(dealership_id))
with check (public.dealership_has_write_access(dealership_id));
create policy subscription_delete_vehicles on public.vehicles as restrictive
for delete to authenticated using (public.dealership_has_write_access(dealership_id));