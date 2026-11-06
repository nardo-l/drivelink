-- Make onboarding trial activation explicit, atomic and safe to retry.
alter table public.dealerships
  add column if not exists onboarding_completed_at timestamptz;

create schema if not exists private;

create table if not exists private.subscription_trial_identities (
  normalized_email text primary key,
  auth_user_id uuid references auth.users(id) on delete set null,
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.activate_dealership_trial()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_dealership_id uuid;
  v_email text;
  v_trial_started_at timestamptz;
  v_trial_ends_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_subscription public.dealership_subscriptions%rowtype;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required to activate a trial.' using errcode = '42501';
  end if;

  select d.id into v_dealership_id
  from public.dealerships d
  where d.user_id = v_user_id
  order by d.created_at desc
  limit 1
  for update;

  if v_dealership_id is null then
    raise exception 'No dealership profile was found for this account.' using errcode = 'P0002';
  end if;

  select s.* into v_subscription
  from public.dealership_subscriptions s
  where s.dealership_id = v_dealership_id
  for update;

  if found and v_subscription.current_period_end > v_now then
    v_status := 'active';
    update public.dealerships
      set onboarding_completed_at = coalesce(onboarding_completed_at, v_now)
      where id = v_dealership_id;
    return jsonb_build_object(
      'status', v_status,
      'trial_started_at', v_subscription.trial_started_at,
      'trial_ends_at', v_subscription.trial_ends_at,
      'onboarding_completed_at', v_now,
      'is_active', true
    );
  end if;

  if found and v_subscription.trial_started_at is not null then
    v_status := case
      when v_subscription.trial_ends_at > v_now then 'trial'
      else 'expired'
    end;
    update public.dealership_subscriptions
      set status = v_status, updated_at = v_now
      where dealership_id = v_dealership_id;
    update public.dealerships
      set onboarding_completed_at = coalesce(onboarding_completed_at, v_now)
      where id = v_dealership_id;
    return jsonb_build_object(
      'status', v_status,
      'trial_started_at', v_subscription.trial_started_at,
      'trial_ends_at', v_subscription.trial_ends_at,
      'onboarding_completed_at', v_now,
      'is_active', v_status = 'trial'
    );
  end if;

  select lower(trim(u.email)) into v_email
  from auth.users u
  where u.id = v_user_id;

  if v_email is null or v_email = '' then
    raise exception 'A verified account email is required to activate a trial.';
  end if;

  select t.trial_started_at, t.trial_ends_at
    into v_trial_started_at, v_trial_ends_at
  from private.subscription_trial_identities t
  where t.normalized_email = v_email
  for update;

  if not found then
    v_trial_started_at := v_now;
    v_trial_ends_at := v_now + interval '72 hours';
    insert into private.subscription_trial_identities
      (normalized_email, auth_user_id, trial_started_at, trial_ends_at)
    values
      (v_email, v_user_id, v_trial_started_at, v_trial_ends_at)
    on conflict (normalized_email) do nothing;

    select t.trial_started_at, t.trial_ends_at
      into v_trial_started_at, v_trial_ends_at
    from private.subscription_trial_identities t
    where t.normalized_email = v_email
    for update;
  end if;

  v_status := case when v_trial_ends_at > v_now then 'trial' else 'expired' end;

  insert into public.dealership_subscriptions
    (dealership_id, user_id, status, trial_started_at, trial_ends_at, trial_used, amount, currency, updated_at)
  values
    (v_dealership_id, v_user_id, v_status, v_trial_started_at, v_trial_ends_at, true, 3.99, 'USD', v_now)
  on conflict (dealership_id) do update set
    status = case
      when public.dealership_subscriptions.current_period_end > v_now
        then public.dealership_subscriptions.status
      when coalesce(public.dealership_subscriptions.trial_ends_at, excluded.trial_ends_at) > v_now
        then 'trial'
      else 'expired'
    end,
    trial_started_at = coalesce(public.dealership_subscriptions.trial_started_at, excluded.trial_started_at),
    trial_ends_at = coalesce(public.dealership_subscriptions.trial_ends_at, excluded.trial_ends_at),
    trial_used = true,
    updated_at = v_now
  returning * into v_subscription;

  if v_subscription.current_period_end > v_now then
    v_status := 'active';
  elsif v_subscription.trial_ends_at > v_now then
    v_status := 'trial';
  else
    v_status := 'expired';
  end if;

  update public.dealership_subscriptions
    set status = v_status, updated_at = v_now
    where dealership_id = v_dealership_id;

  update public.dealerships
    set onboarding_completed_at = coalesce(onboarding_completed_at, v_now)
    where id = v_dealership_id;

  return jsonb_build_object(
    'status', v_status,
    'trial_started_at', v_subscription.trial_started_at,
    'trial_ends_at', v_subscription.trial_ends_at,
    'onboarding_completed_at', v_now,
    'is_active', v_status in ('trial', 'active')
  );
end;
$$;

revoke all on function public.activate_dealership_trial() from public, anon;
grant execute on function public.activate_dealership_trial() to authenticated;
