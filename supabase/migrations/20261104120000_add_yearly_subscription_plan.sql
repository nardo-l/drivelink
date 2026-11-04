-- Add discounted annual subscriptions while preserving existing monthly records.
alter table public.dealership_subscriptions
  drop constraint if exists dealership_subscriptions_amount_check;
alter table public.dealership_subscriptions
  add constraint dealership_subscriptions_amount_check check (amount in (3.99, 32.00));

alter table public.dealership_subscriptions
  drop constraint if exists dealership_subscriptions_plan_code_check;
alter table public.dealership_subscriptions
  add constraint dealership_subscriptions_plan_code_check check (plan_code in ('monthly', 'yearly'));

alter table public.dealership_subscription_payments
  drop constraint if exists dealership_subscription_payments_amount_check;
alter table public.dealership_subscription_payments
  add constraint dealership_subscription_payments_amount_check check (amount in (3.99, 32.00));

alter table public.dealership_subscription_payments
  add column if not exists plan_code text not null default 'monthly';
alter table public.dealership_subscription_payments
  drop constraint if exists dealership_subscription_payments_plan_code_check;
alter table public.dealership_subscription_payments
  add constraint dealership_subscription_payments_plan_code_check check (plan_code in ('monthly', 'yearly'));

create or replace function public.apply_dealership_subscription_payment(
  p_reference text,
  p_paynow_reference text default null,
  p_raw_status text default 'Paid'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.dealership_subscription_payments%rowtype;
  subscription_row_id uuid;
  now_at timestamptz := now();
  period_interval interval;
begin
  select * into payment_row from public.dealership_subscription_payments
  where reference = p_reference for update;
  if not found then return false; end if;
  if payment_row.status = 'paid' then return true; end if;

  if payment_row.plan_code = 'yearly' and payment_row.amount = 32.00 then
    period_interval := interval '365 days';
  elsif payment_row.plan_code = 'monthly' and payment_row.amount = 3.99 then
    period_interval := interval '30 days';
  else
    return false;
  end if;

  update public.dealership_subscription_payments
  set status = 'paid', paynow_reference = coalesce(p_paynow_reference, paynow_reference),
      raw_status = p_raw_status, paid_at = now_at, updated_at = now_at
  where id = payment_row.id;

  insert into public.dealership_subscriptions (
    dealership_id, user_id, plan_code, amount, currency, status,
    current_period_start, current_period_end, grace_until, updated_at
  ) values (
    payment_row.dealership_id, payment_row.user_id, payment_row.plan_code,
    payment_row.amount, 'USD', 'active', now_at,
    now_at + period_interval, now_at + period_interval + interval '3 days', now_at
  )
  on conflict (dealership_id) do update set
    status = 'active', plan_code = excluded.plan_code, amount = excluded.amount, currency = 'USD',
    current_period_start = case
      when public.dealership_subscriptions.current_period_end > now_at
      then public.dealership_subscriptions.current_period_start else now_at end,
    current_period_end = greatest(coalesce(public.dealership_subscriptions.current_period_end, now_at), now_at) + period_interval,
    grace_until = greatest(coalesce(public.dealership_subscriptions.current_period_end, now_at), now_at) + period_interval + interval '3 days',
    updated_at = now_at
  returning id into subscription_row_id;

  update public.dealership_subscription_payments set subscription_id = subscription_row_id
  where reference = p_reference;
  return true;
end;
$$;

revoke all on function public.apply_dealership_subscription_payment(text,text,text) from public, anon, authenticated;
grant execute on function public.apply_dealership_subscription_payment(text,text,text) to service_role;
