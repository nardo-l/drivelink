create table if not exists public.dealership_subscriptions (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null unique references public.dealerships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null default 'monthly',
  amount numeric(10,2) not null default 3.99 check (amount = 3.99),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'inactive' check (status in ('inactive','active','grace_period','expired','cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealership_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.dealership_subscriptions(id) on delete set null,
  reference text not null unique,
  paynow_reference text,
  amount numeric(10,2) not null default 3.99 check (amount = 3.99),
  currency text not null default 'USD' check (currency = 'USD'),
  payment_method text not null default 'EcoCash',
  status text not null default 'created' check (status in ('created','pending','paid','cancelled','failed')),
  poll_url text,
  browser_url text,
  paid_at timestamptz,
  raw_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dealership_subscription_payments_user_created_idx
  on public.dealership_subscription_payments(user_id, created_at desc);

alter table public.dealership_subscriptions enable row level security;
alter table public.dealership_subscription_payments enable row level security;

drop policy if exists "Users can read their dealership subscription" on public.dealership_subscriptions;
create policy "Users can read their dealership subscription"
  on public.dealership_subscriptions for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can read their own subscription payments" on public.dealership_subscription_payments;
create policy "Users can read their own subscription payments"
  on public.dealership_subscription_payments for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.dealership_subscriptions from anon, authenticated;
revoke insert, update, delete on public.dealership_subscription_payments from anon, authenticated;
grant select on public.dealership_subscriptions to authenticated;
grant select on public.dealership_subscription_payments to authenticated;

create or replace function public.apply_dealership_subscription_payment(p_reference text, p_paynow_reference text default null, p_raw_status text default 'Paid')
returns boolean language plpgsql security definer set search_path = public as $$
declare
  payment_row public.dealership_subscription_payments%rowtype;
  subscription_row_id uuid;
  now_at timestamptz := now();
begin
  select * into payment_row from public.dealership_subscription_payments
  where reference = p_reference for update;
  if not found then return false; end if;
  if payment_row.status = 'paid' then return true; end if;

  update public.dealership_subscription_payments
  set status = 'paid', paynow_reference = coalesce(p_paynow_reference, paynow_reference),
      raw_status = p_raw_status, paid_at = now_at, updated_at = now_at
  where id = payment_row.id;

  insert into public.dealership_subscriptions (
    dealership_id, user_id, plan_code, amount, currency, status,
    current_period_start, current_period_end, grace_until, updated_at
  ) values (
    payment_row.dealership_id, payment_row.user_id, 'monthly', 3.99, 'USD', 'active',
    now_at, now_at + interval '30 days', now_at + interval '33 days', now_at
  )
  on conflict (dealership_id) do update set
    status = 'active', amount = 3.99, currency = 'USD',
    current_period_start = case
      when public.dealership_subscriptions.current_period_end > now_at
      then public.dealership_subscriptions.current_period_start else now_at end,
    current_period_end = greatest(coalesce(public.dealership_subscriptions.current_period_end, now_at), now_at) + interval '30 days',
    grace_until = greatest(coalesce(public.dealership_subscriptions.current_period_end, now_at), now_at) + interval '33 days',
    updated_at = now_at
  returning id into subscription_row_id;

  update public.dealership_subscription_payments set subscription_id = subscription_row_id
  where reference = p_reference;
  return true;
end;
$$;

revoke all on function public.apply_dealership_subscription_payment(text,text,text) from public, anon, authenticated;
grant execute on function public.apply_dealership_subscription_payment(text,text,text) to service_role;
