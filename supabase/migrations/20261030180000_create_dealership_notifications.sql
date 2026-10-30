-- DriveLink notification foundation: in-app inbox, preferences, push endpoints and real activity events.
create table if not exists public.notification_preferences (
  dealership_id uuid primary key references public.dealerships(id) on delete cascade,
  daily_summary boolean not null default true,
  new_enquiries boolean not null default true,
  vehicle_reminders boolean not null default true,
  share_reminders boolean not null default true,
  showroom_activity boolean not null default true,
  subscription_reminders boolean not null default true,
  push_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  category text not null check (category in ('daily_summary','enquiry','inventory','sharing','showroom','subscription','system')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_dedupe_unique unique (dealership_id, dedupe_key)
);
create index if not exists notifications_dealership_created_idx on public.notifications(dealership_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(dealership_id, created_at desc) where read_at is null;
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text
);
create index if not exists push_subscriptions_dealership_idx on public.push_subscriptions(dealership_id);
create table if not exists public.notification_events (
  id bigint generated always as identity primary key,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  event_type text not null check (event_type in ('enquiry_created','vehicle_created','vehicle_updated','vehicle_sold','showroom_view','showroom_shared')),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists notification_events_dealership_time_idx on public.notification_events(dealership_id, occurred_at desc);
create index if not exists notification_events_type_time_idx on public.notification_events(event_type, occurred_at desc);
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_events enable row level security;
drop policy if exists "Dealership owners manage notification preferences" on public.notification_preferences;
create policy "Dealership owners manage notification preferences" on public.notification_preferences for all to authenticated
using (exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())))
with check (exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())));
drop policy if exists "Dealership owners read notifications" on public.notifications;
create policy "Dealership owners read notifications" on public.notifications for select to authenticated
using (exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())));
drop policy if exists "Dealership owners update notifications" on public.notifications;
create policy "Dealership owners update notifications" on public.notifications for update to authenticated
using (exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())))
with check (exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())));
drop policy if exists "Dealership owners manage push subscriptions" on public.push_subscriptions;
create policy "Dealership owners manage push subscriptions" on public.push_subscriptions for all to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())))
with check (user_id = (select auth.uid()) and exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())));
drop policy if exists "Dealership owners read notification events" on public.notification_events;
create policy "Dealership owners read notification events" on public.notification_events for select to authenticated
using (exists (select 1 from public.dealerships d where d.id = dealership_id and d.user_id = (select auth.uid())));
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.notification_events to authenticated;
create or replace function public.capture_notification_event()
returns trigger language plpgsql security definer set search_path = public
as $$
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
$$;
drop trigger if exists enquiries_notification_event on public.enquiries;
create trigger enquiries_notification_event after insert on public.enquiries for each row execute function public.capture_notification_event();
drop trigger if exists vehicles_notification_event on public.vehicles;
create trigger vehicles_notification_event after insert or update of status on public.vehicles for each row execute function public.capture_notification_event();
drop trigger if exists storefront_view_notification_event on public.storefront_view_events;
create trigger storefront_view_notification_event after insert on public.storefront_view_events for each row execute function public.capture_notification_event();
revoke all on function public.capture_notification_event() from public, anon, authenticated;
