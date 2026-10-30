-- DriveLink: one-time 72-hour trial and server-enforced view-only expiry.
alter table public.dealership_subscriptions
  drop constraint if exists dealership_subscriptions_status_check;
alter table public.dealership_subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_used boolean not null default false;
alter table public.dealership_subscriptions
  add constraint dealership_subscriptions_status_check
  check (status = any (array['inactive','trial','active','grace_period','expired','cancelled']));

-- Existing dealerships receive a single 72-hour transition trial. Existing rows are never reset.
insert into public.dealership_subscriptions
  (dealership_id,user_id,status,trial_started_at,trial_ends_at,trial_used,amount,currency,updated_at)
select d.id,d.user_id,'trial',now(),now()+interval '72 hours',true,3.99,'USD',now()
from public.dealerships d
on conflict (dealership_id) do nothing;

create or replace function public.start_dealership_trial()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.dealership_subscriptions
    (dealership_id,user_id,status,trial_started_at,trial_ends_at,trial_used,amount,currency)
  values (new.id,new.user_id,'trial',now(),now()+interval '72 hours',true,3.99,'USD')
  on conflict (dealership_id) do nothing;
  return new;
end;
$$;
drop trigger if exists dealerships_start_trial on public.dealerships;
create trigger dealerships_start_trial after insert on public.dealerships
for each row execute function public.start_dealership_trial();

-- Called by restrictive RLS policies; checks ownership and subscription timestamps on the server.
create or replace function public.dealership_has_write_access(p_dealership_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.dealerships d
    join public.dealership_subscriptions s on s.dealership_id=d.id
    where d.id=p_dealership_id and d.user_id=(select auth.uid())
      and (
        (s.status='trial' and s.trial_ends_at > now())
        or (s.current_period_end > now())
        or (s.current_period_end is not null and s.grace_until >= now())
      )
  );
$$;
revoke all on function public.dealership_has_write_access(uuid) from public,anon;
grant execute on function public.dealership_has_write_access(uuid) to authenticated;

-- Restrictive policies compose with existing owner policies instead of replacing them.
create policy subscription_write_dealership on public.dealerships as restrictive
for update to authenticated
using (public.dealership_has_write_access(id))
with check (public.dealership_has_write_access(id));
create policy subscription_write_vehicles on public.vehicles as restrictive
for all to authenticated
using (public.dealership_has_write_access(dealership_id))
with check (public.dealership_has_write_access(dealership_id));
create policy subscription_write_enquiries on public.enquiries as restrictive
for update to authenticated
using (public.dealership_has_write_access(dealership_id))
with check (public.dealership_has_write_access(dealership_id));
create policy subscription_delete_enquiries on public.enquiries as restrictive
for delete to authenticated
using (public.dealership_has_write_access(dealership_id));

-- Preserve unused trial time when the first payment is made during the trial.
create or replace function public.apply_dealership_subscription_payment(
  p_reference text, p_paynow_reference text, p_raw_status text
) returns boolean language plpgsql security definer set search_path=public as $$
declare
  payment_row public.dealership_subscription_payments%rowtype;
  subscription_row_id uuid;
  now_at timestamptz := now();
  trial_end timestamptz;
  old_period_end timestamptz;
  period_start timestamptz;
begin
  select * into payment_row from public.dealership_subscription_payments
  where reference=p_reference for update;
  if not found then return false; end if;
  if payment_row.status='paid' then return true; end if;

  select id,trial_ends_at,current_period_end
    into subscription_row_id,trial_end,old_period_end
  from public.dealership_subscriptions
  where dealership_id=payment_row.dealership_id for update;

  update public.dealership_subscription_payments
  set status='paid',paynow_reference=coalesce(p_paynow_reference,paynow_reference),
      raw_status=p_raw_status,paid_at=now_at,updated_at=now_at
  where id=payment_row.id;

  if old_period_end is null then
    period_start := greatest(now_at,coalesce(trial_end,now_at));
  else
    period_start := greatest(now_at,old_period_end);
  end if;

  insert into public.dealership_subscriptions
    (dealership_id,user_id,plan_code,amount,currency,status,current_period_start,current_period_end,grace_until,updated_at)
  values (payment_row.dealership_id,payment_row.user_id,'monthly',3.99,'USD','active',
    period_start,period_start+interval '30 days',period_start+interval '33 days',now_at)
  on conflict (dealership_id) do update set
    status='active',amount=3.99,currency='USD',
    current_period_start=period_start,current_period_end=period_start+interval '30 days',
    grace_until=period_start+interval '33 days',updated_at=now_at
  returning id into subscription_row_id;

  update public.dealership_subscription_payments
  set subscription_id=subscription_row_id where reference=p_reference;
  return true;
end;
$$;
revoke all on function public.apply_dealership_subscription_payment(text,text,text) from public,anon,authenticated;
grant execute on function public.apply_dealership_subscription_payment(text,text,text) to service_role;
