-- Lotlé notification worker schedule.
-- Safe to run repeatedly: cron.schedule replaces an existing job with the same name.
-- Before running, add Vault secret "lotle_notification_cron_secret" with the same value
-- as the Supabase Edge Function secret NOTIFICATION_CRON_SECRET.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'lotle-notification-worker',
  '* * * * *',
  $lotle$
    select net.http_post(
      url := 'https://cimyerrelscqjiwqvnnn.supabase.co/functions/v1/drivelink-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notification-secret',
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'lotle_notification_cron_secret'
         limit 1)
      ),
      body := jsonb_build_object('action', 'scheduled'),
      timeout_milliseconds := 5000
    );
  $lotle$
);
