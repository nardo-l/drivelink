-- Restore the original activity capture function unchanged.
-- Enrich its existing enquiry inbox row with Lotlé copy and deep-link metadata
-- through additive triggers, without replacing the existing event-capture triggers.

create or replace function public.capture_notification_event()
returns trigger language plpgsql security definer set search_path = public
as $function$
declare v_dealership_id uuid; v_event_type text; v_entity_id text; v_title text; v_body text; v_category text; v_key text;
begin
  if tg_table_name = 'enquiries' then
    v_dealership_id := new.dealership_id; v_entity_id := new.id::text; v_event_type := 'enquiry_created'; v_category := 'enquiry';
    v_title := 'New buyer enquiry';
    v_body := coalesce(nullif(new.buyer_name,''),'A buyer') || ' sent an enquiry' || case when new.vehicle_id is not null then ' about a vehicle.' else '.' end;
    v_key := 'enquiry:' || new.id::text;
  elsif tg_table_name = 'vehicles' then
    v_dealership_id := new.dealership_id; v_entity_id := new.id::text;
    if tg_op = 'INSERT' then
      v_event_type := 'vehicle_created'; v_category := 'inventory'; v_title := 'Vehicle added';
      v_body := concat_ws(' ',new.year,new.make,new.model) || ' was added to your inventory.'; v_key := 'vehicle-created:' || new.id::text;
    elsif new.status = 'sold' and old.status is distinct from 'sold' then
      v_event_type := 'vehicle_sold'; v_category := 'showroom'; v_title := 'Vehicle marked as sold';
      v_body := concat_ws(' ',new.year,new.make,new.model) || ' was marked as sold.'; v_key := 'vehicle-sold:' || new.id::text;
    else v_event_type := 'vehicle_updated'; v_category := null;
    end if;
  elsif tg_table_name = 'storefront_view_events' then
    v_dealership_id := new.dealership_id; v_entity_id := new.id::text; v_event_type := 'showroom_view'; v_category := null;
  end if;
  insert into public.notification_events(dealership_id,event_type,entity_id,metadata)
  values (v_dealership_id,v_event_type,v_entity_id,jsonb_build_object('table',tg_table_name));
  if v_category is not null then
    insert into public.notifications(dealership_id,category,title,body,data,dedupe_key)
    values (v_dealership_id,v_category,v_title,v_body,jsonb_build_object('entity_id',v_entity_id),v_key)
    on conflict (dealership_id,dedupe_key) do nothing;
  end if;
  return new;
end;
$function$;
revoke all on function public.capture_notification_event() from public, anon, authenticated;

create or replace function public.enrich_lotle_enquiry_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  vehicle_label text := 'vehicle';
begin
  if new.vehicle_id is not null then
    select concat_ws(' ', year, make, model) into vehicle_label
    from public.vehicles where id = new.vehicle_id;
    vehicle_label := coalesce(nullif(vehicle_label, ''), 'vehicle');
  end if;

  update public.notifications
  set title = 'New enquiry',
      body = coalesce(nullif(new.buyer_name, ''), 'A buyer') || ' asked about your ' || vehicle_label,
      dedupe_key = 'new_enquiry:' || new.id::text,
      data = jsonb_build_object(
        'eventId', 'new_enquiry',
        'entityId', new.id::text,
        'url', '/app/enquiries?enquiry=' || new.id::text,
        'priority', 'urgent',
        'channels', jsonb_build_array('push', 'in_app')
      )
  where dealership_id = new.dealership_id
    and dedupe_key = 'enquiry:' || new.id::text
    and category = 'enquiry';

  return new;
end;
$function$;
revoke all on function public.enrich_lotle_enquiry_notification() from public, anon, authenticated;

drop trigger if exists lotle_enquiries_enrich_notification on public.enquiries;
create trigger lotle_enquiries_enrich_notification
  after insert on public.enquiries
  for each row execute function public.enrich_lotle_enquiry_notification();

drop trigger if exists notifications_dispatch_immediate_update on public.notifications;
create trigger notifications_dispatch_immediate_update
  after update of data on public.notifications
  for each row
  when (
    old.data->>'eventId' is distinct from new.data->>'eventId'
    and new.data->>'eventId' in ('new_enquiry', 'payment_confirmed')
  )
  execute function public.dispatch_lotle_notification_push();
