-- Extend the existing Lotlé notification pipeline without replacing its tables or triggers.
-- Safe to apply more than once.

create extension if not exists pg_net with schema extensions;

create table if not exists public.notification_attempts (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions(id) on delete set null,
  attempt_number integer not null check (attempt_number between 1 and 3),
  status text not null check (status in ('sent', 'failed', 'gone', 'skipped')),
  response_status integer,
  error_message text,
  attempted_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  constraint notification_attempts_unique unique (notification_id, push_subscription_id, attempt_number)
);

create index if not exists notification_attempts_retry_idx
  on public.notification_attempts(notification_id, next_attempt_at)
  where status = 'failed';

alter table public.notification_attempts enable row level security;
drop policy if exists "Dealership owners read notification attempts" on public.notification_attempts;
create policy "Dealership owners read notification attempts"
  on public.notification_attempts for select to authenticated
  using (
    exists (
      select 1
      from public.notifications n
      join public.dealerships d on d.id = n.dealership_id
      where n.id = notification_id
        and d.user_id = (select auth.uid())
    )
  );
grant select on public.notification_attempts to authenticated;

-- Keep the existing payment flow unchanged; only observe a confirmed status transition.
create or replace function public.capture_lotle_payment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_amount text;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    payment_amount := trim(to_char(new.amount, 'FM999999990.00'));
    insert into public.notifications(dealership_id, category, title, body, data, dedupe_key)
    values (
      new.dealership_id,
      'subscription',
      'Payment confirmed',
      'Your Lotlé payment of ' || payment_amount || ' ' || coalesce(new.currency, 'USD') || ' was confirmed.',
      jsonb_build_object('url', '/app/billing', 'eventId', 'payment_confirmed', 'paymentId', new.id),
      'payment_confirmed:' || new.id::text
    )
    on conflict (dealership_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists lotle_payment_notification on public.dealership_subscription_payments;
create trigger lotle_payment_notification
  after update of status on public.dealership_subscription_payments
  for each row execute function public.capture_lotle_payment_notification();
revoke all on function public.capture_lotle_payment_notification() from public, anon, authenticated;

-- A new inbox row wakes the server worker immediately. The shared secret is read from Vault,
-- never from a browser request or a table exposed through the Data API.
create or replace function public.dispatch_lotle_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_secret text;
begin
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
$$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_lotle_notification_push();
revoke all on function public.dispatch_lotle_notification_push() from public, anon, authenticated;
