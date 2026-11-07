-- Automatically provision the existing three-day trial when a dealership is created.
-- Preserve existing table names, columns, status values, billing, and access-gate contracts.
alter table private.subscription_trial_identities
  add column if not exists normalized_phone text;

create unique index if not exists subscription_trial_identities_normalized_phone_uidx
  on private.subscription_trial_identities (normalized_phone)
  where normalized_phone is not null;

create or replace function private.activate_dealership_trial_for_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dealership_id uuid;
  v_email text;
  v_phone text;
  v_trial_started_at timestamptz;
  v_trial_ends_at timestamptz;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_subscription public.dealership_subscriptions%rowtype;
  v_status text;
begin
  if p_user_id is null then
    raise exception 'A user ID is required to provision a dealership trial.' using errcode = '42501';
  end if;

  select lower(btrim(u.email)) into v_email
  from auth.users u where u.id = p_user_id;

  if v_email is null or v_email = '' then
    raise exception 'A verified account email is required to provision a trial.';
  end if;

  select d.id,
         nullif(pg_catalog.regexp_replace(
           coalesce(nullif(d.phone, ''), nullif(d.whatsapp, ''), ''),
           '[^0-9]', '', 'g'
         ), '')
    into v_dealership_id, v_phone
  from public.dealerships d
  where d.user_id = p_user_id
  order by d.created_at desc
  limit 1
  for update;

  if v_dealership_id is null then
    raise exception 'No dealership profile was found for this account.' using errcode = 'P0002';
  end if;

  if v_phone is not null and pg_catalog.length(v_phone) < 7 then
    v_phone := null;
  end if;

  select s.* into v_subscription
  from public.dealership_subscriptions s
  where s.dealership_id = v_dealership_id
  for update;

  if found and v_subscription.current_period_end is not null
     and v_subscription.current_period_end > v_now then
    v_status := 'active';
  elsif found and v_subscription.trial_started_at is not null then
    v_status := case when v_subscription.trial_ends_at > v_now then 'trial' else 'expired' end;
    update public.dealership_subscriptions
      set status = v_status, updated_at = v_now
      where dealership_id = v_dealership_id;
  else
    -- Serialize concurrent attempts for the same email and phone identities.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('trial-email:' || v_email, 0)
    );
    if v_phone is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('trial-phone:' || v_phone, 0)
      );
    end if;

    select t.trial_started_at, t.trial_ends_at
      into v_trial_started_at, v_trial_ends_at
    from private.subscription_trial_identities t
    where t.normalized_email = v_email
       or (v_phone is not null and t.normalized_phone = v_phone)
    order by t.trial_started_at asc, t.created_at asc
    limit 1
    for update;

    if not found then
      v_trial_started_at := v_now;
      v_trial_ends_at := v_now + interval '72 hours';
    end if;

    if not exists (
      select 1 from private.subscription_trial_identities t
      where t.normalized_email = v_email
    ) then
      insert into private.subscription_trial_identities
        (normalized_email, auth_user_id, trial_started_at, trial_ends_at, normalized_phone)
      values (
        v_email, p_user_id, v_trial_started_at, v_trial_ends_at,
        case when v_phone is not null and not exists (
          select 1 from private.subscription_trial_identities t
          where t.normalized_phone = v_phone
        ) then v_phone else null end
      )
      on conflict do nothing;
    elsif v_phone is not null then
      update private.subscription_trial_identities t
        set normalized_phone = v_phone, updated_at = v_now
      where t.normalized_email = v_email
        and t.normalized_phone is null
        and not exists (
          select 1 from private.subscription_trial_identities other
          where other.normalized_phone = v_phone
        );
    end if;

    -- Re-read after identity creation so a previously claimed identity wins.
    select t.trial_started_at, t.trial_ends_at
      into v_trial_started_at, v_trial_ends_at
    from private.subscription_trial_identities t
    where t.normalized_email = v_email
       or (v_phone is not null and t.normalized_phone = v_phone)
    order by t.trial_started_at asc, t.created_at asc
    limit 1
    for update;

    if not found then
      raise exception 'Trial identity could not be reserved.';
    end if;

    v_status := case when v_trial_ends_at > v_now then 'trial' else 'expired' end;

    insert into public.dealership_subscriptions
      (dealership_id, user_id, status, trial_started_at, trial_ends_at,
       trial_used, amount, currency, updated_at)
    values
      (v_dealership_id, p_user_id, v_status, v_trial_started_at, v_trial_ends_at,
       true, 3.99, 'USD', v_now)
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

    if v_subscription.current_period_end is not null
       and v_subscription.current_period_end > v_now then
      v_status := 'active';
    elsif v_subscription.trial_ends_at > v_now then
      v_status := 'trial';
    else
      v_status := 'expired';
    end if;

    update public.dealership_subscriptions
      set status = v_status, updated_at = v_now
      where dealership_id = v_dealership_id;
  end if;

  update public.dealerships
    set onboarding_completed_at = coalesce(onboarding_completed_at, v_now)
  where id = v_dealership_id;

  insert into public.user_onboarding_progress
    (user_id, onboarding_step, intro_completed, onboarding_completed_at, updated_at)
  values (p_user_id, 7, true, v_now, v_now)
  on conflict (user_id) do update set
    onboarding_step = greatest(coalesce(public.user_onboarding_progress.onboarding_step, 0), 7),
    intro_completed = true,
    onboarding_completed_at = coalesce(public.user_onboarding_progress.onboarding_completed_at, v_now),
    updated_at = v_now;

  return jsonb_build_object(
    'status', v_status,
    'trial_started_at', v_subscription.trial_started_at,
    'trial_ends_at', v_subscription.trial_ends_at,
    'onboarding_completed_at', v_now,
    'is_active', v_status in ('trial', 'active')
  );
end;
$$;

create or replace function public.activate_dealership_trial()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required to activate a trial.' using errcode = '42501';
  end if;
  return private.activate_dealership_trial_for_user(v_user_id);
end;
$$;

revoke all on function private.activate_dealership_trial_for_user(uuid) from public, anon, authenticated;
revoke all on function public.activate_dealership_trial() from public, anon;
grant execute on function public.activate_dealership_trial() to authenticated;

create or replace function private.start_dealership_trial_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text;
  v_detail text;
  v_hint text;
  v_context text;
  v_state text;
begin
  perform private.activate_dealership_trial_for_user(new.user_id);
  return new;
exception when others then
  get stacked diagnostics
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint,
    v_context = pg_exception_context,
    v_state = returned_sqlstate;
  raise log 'Automatic trial setup failed for dealership % (user %): SQLSTATE %, message %, detail %, hint %, context %',
    new.id, new.user_id, v_state, v_message, v_detail, v_hint, v_context;
  return new;
end;
$$;

drop trigger if exists dealerships_auto_start_trial on public.dealerships;
create trigger dealerships_auto_start_trial
after insert on public.dealerships
for each row execute function private.start_dealership_trial_after_insert();

-- Retry automatically when the user next signs in after a transient insert-time failure.
create or replace function private.retry_dealership_trial_after_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text;
  v_detail text;
  v_hint text;
  v_context text;
  v_state text;
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at
     and exists (select 1 from public.dealerships d where d.user_id = new.id) then
    perform private.activate_dealership_trial_for_user(new.id);
  end if;
  return new;
exception when others then
  get stacked diagnostics
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint,
    v_context = pg_exception_context,
    v_state = returned_sqlstate;
  raise log 'Sign-in trial retry failed for user %: SQLSTATE %, message %, detail %, hint %, context %',
    new.id, v_state, v_message, v_detail, v_hint, v_context;
  return new;
end;
$$;

drop trigger if exists auth_users_retry_dealership_trial on auth.users;
create trigger auth_users_retry_dealership_trial
after update of last_sign_in_at on auth.users
for each row execute function private.retry_dealership_trial_after_sign_in();
