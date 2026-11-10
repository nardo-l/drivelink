-- Only immediate events wake the worker from the notification insert trigger.
-- Scheduled events are processed by pg_cron, avoiding duplicate concurrent delivery.

create or replace function public.dispatch_lotle_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  worker_secret text;
begin
  if coalesce(new.data->>'eventId', '') not in ('new_enquiry', 'payment_confirmed') then
    return new;
  end if;

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'lotle_notification_cron_secret'
  limit 1;

  if worker_secret is not null and length(worker_secret) >= 32 then
    perform net.http_post(
      url := 'https://cimyerrelscqjiwqvnnn.supabase.co/functions/v1/drivelink-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-secret', worker_secret
      ),
      body := jsonb_build_object('action', 'dispatch', 'notificationId', new.id),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$function$;
revoke all on function public.dispatch_lotle_notification_push() from public, anon, authenticated;
