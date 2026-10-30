-- Track a user-initiated showroom share action without claiming the link was successfully sent.
alter table public.notification_events drop constraint if exists notification_events_event_type_check;
alter table public.notification_events add constraint notification_events_event_type_check
check (event_type = any (array['enquiry_created','vehicle_created','vehicle_updated','vehicle_sold','showroom_view','showroom_share_started']::text[]));