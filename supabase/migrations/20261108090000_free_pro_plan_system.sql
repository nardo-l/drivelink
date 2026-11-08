-- Lotlé Free / Pro plans. Safe to re-run; does not alter NardoPay payment flow or prices.
-- Plan limits and feature flags live in private.plan_config() and are returned to the UI by get_my_plan().

alter table public.dealership_subscriptions
  add column if not exists pro_trial_ends_at timestamptz;

alter table private.subscription_trial_identities
  add column if not exists pro_trial_started_at timestamptz,
  add column if not exists pro_trial_ends_at timestamptz;

alter table public.vehicles
  add column if not exists plan_hidden_status text;

create unique index if not exists subscription_trial_identities_normalized_phone_uidx
  on private.subscription_trial_identities(normalized_phone)
  where normalized_phone is not null;

create or replace function private.plan_config()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'free', jsonb_build_object(
      'maxVehicles', 3, 'maxPhotosPerVehicle', 5,
      'analyticsCharts', false, 'analyticsPeriods', jsonb_build_array(),
      'showPoweredBy', true, 'supportLevel', 'standard'
    ),
    'pro', jsonb_build_object(
      'maxVehicles', null, 'maxPhotosPerVehicle', 10,
      'analyticsCharts', true, 'analyticsPeriods', jsonb_build_array(7,30,90),
      'showPoweredBy', false, 'supportLevel', 'priority'
    ),
    'sharedFeatures', jsonb_build_object(
      'showroomLink', true, 'landingPage', true, 'logoAndBanner', true,
      'whatsapp', true, 'enquiries', true, 'enquiryPushNotifications', true
    )
  );
$$;

create or replace function private.dealership_plan(p_dealership_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.dealership_subscriptions s
      where s.dealership_id = p_dealership_id
        and s.status = 'active'
        and s.current_period_end > pg_catalog.now()
    ) then 'pro'
    when exists (
      select 1 from public.dealership_subscriptions s
      where s.dealership_id = p_dealership_id
        and s.pro_trial_ends_at > pg_catalog.now()
    ) then 'pro'
    else 'free'
  end;
$$;

-- Ownership, not subscription dates, controls ordinary write access.
-- Existing RLS policies that call this helper inherit the new ownership-only rule.
create or replace function private.dealership_has_write_access(p_dealership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dealerships d
    where d.id = p_dealership_id
      and d.user_id = (select auth.uid())
  );
$$;

create or replace function private.reconcile_dealership_plan(p_dealership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
begin
  v_plan := private.dealership_plan(p_dealership_id);

  if v_plan = 'pro' then
    update public.vehicles
      set status = coalesce(plan_hidden_status, status),
          plan_hidden_status = null,
          updated_at = pg_catalog.now()
    where dealership_id = p_dealership_id
      and status = 'hidden'
      and plan_hidden_status is not null;
  else
    with ranked as (
      select id,
             row_number() over (
               order by case when status in ('available','reserved','sold') then 0 else 1 end,
                        updated_at desc, created_at desc, id
             ) as position
      from public.vehicles
      where dealership_id = p_dealership_id
        and status <> 'hidden'
    )
    update public.vehicles v
      set plan_hidden_status = coalesce(v.plan_hidden_status, v.status),
          status = 'hidden',
          updated_at = pg_catalog.now()
    from ranked r
    where v.id = r.id
      and r.position > 3
      and v.status <> 'hidden';
  end if;
end;
$$;

create or replace function public.get_my_plan()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_dealership_id uuid;
  v_sub public.dealership_subscriptions%rowtype;
  v_plan text;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select d.id into v_dealership_id
  from public.dealerships d where d.user_id = v_user
  order by d.created_at desc limit 1;
  if v_dealership_id is null then
    return jsonb_build_object('plan','free','config',private.plan_config());
  end if;
  perform private.reconcile_dealership_plan(v_dealership_id);
  select s.* into v_sub from public.dealership_subscriptions s
  where s.dealership_id = v_dealership_id;
  v_plan := private.dealership_plan(v_dealership_id);
  return jsonb_build_object(
    'plan',v_plan,
    'pro_trial_ends_at',v_sub.pro_trial_ends_at,
    'current_period_end',v_sub.current_period_end,
    'subscription_status',v_sub.status,
    'dealership_id',v_dealership_id,
    'config',private.plan_config()
  );
end;
$$;

create or replace function public.get_public_dealership_plan(p_dealership_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_plan text;
begin
  if not exists (
    select 1 from public.dealerships d
    where d.id = p_dealership_id and d.is_published = true
  ) then
    raise exception 'Showroom unavailable' using errcode = 'P0002';
  end if;
  perform private.reconcile_dealership_plan(p_dealership_id);
  v_plan := private.dealership_plan(p_dealership_id);
  return jsonb_build_object('plan',v_plan,'config',private.plan_config());
end;
$$;

revoke all on function public.get_my_plan() from public, anon;
grant execute on function public.get_my_plan() to authenticated;
grant execute on function public.get_public_dealership_plan(uuid) to anon, authenticated;

-- Claim one 14-day Pro trial per email OR phone identity. Existing three-day
-- trial history is kept untouched; Pro trial identity fields are separate.
create or replace function private.start_pro_trial_for_dealership(p_dealership_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
  v_phone text;
  v_now timestamptz := pg_catalog.now();
  v_identity private.subscription_trial_identities%rowtype;
  v_has_prior boolean := false;
  v_start timestamptz;
  v_end timestamptz;
begin
  select d.user_id,
         lower(pg_catalog.btrim(u.email)),
         nullif(pg_catalog.regexp_replace(coalesce(nullif(d.phone,''),nullif(d.whatsapp,''),''),'[^0-9]','','g'),'')
    into v_user_id,v_email,v_phone
  from public.dealerships d
  join auth.users u on u.id=d.user_id
  where d.id=p_dealership_id
  for update of d;

  if v_user_id is null then
    raise exception 'Dealership owner/email not found' using errcode='P0002';
  end if;
  if v_phone is not null and pg_catalog.length(v_phone)<7 then v_phone:=null; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pro-email:'||coalesce(v_email,''),0));
  if v_phone is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pro-phone:'||v_phone,0));
  end if;

  select * into v_identity
  from private.subscription_trial_identities t
  where (v_email is not null and t.normalized_email=v_email)
     or (v_phone is not null and t.normalized_phone=v_phone)
  order by t.created_at
  limit 1
  for update;

  select exists(
    select 1 from private.subscription_trial_identities t
    where ((v_email is not null and t.normalized_email=v_email)
        or (v_phone is not null and t.normalized_phone=v_phone))
      and t.pro_trial_started_at is not null
  ) into v_has_prior;

  if not v_has_prior then
    v_start:=v_now;
    v_end:=v_now+interval '14 days';

    if v_identity.normalized_email is null and v_identity.normalized_phone is null then
      insert into private.subscription_trial_identities
        (normalized_email,auth_user_id,trial_started_at,trial_ends_at,normalized_phone,pro_trial_started_at,pro_trial_ends_at)
      values (v_email,v_user_id,v_now,v_now+interval '72 hours',v_phone,v_start,v_end)
      on conflict (normalized_email) do update
        set pro_trial_started_at=coalesce(private.subscription_trial_identities.pro_trial_started_at,excluded.pro_trial_started_at),
            pro_trial_ends_at=coalesce(private.subscription_trial_identities.pro_trial_ends_at,excluded.pro_trial_ends_at);
    else
      update private.subscription_trial_identities t
      set pro_trial_started_at=coalesce(t.pro_trial_started_at,v_start),
          pro_trial_ends_at=coalesce(t.pro_trial_ends_at,v_end),
          normalized_phone=case
            when v_phone is not null and (t.normalized_phone is null or t.normalized_phone=v_phone)
                 and not exists(select 1 from private.subscription_trial_identities other where other.normalized_phone=v_phone and other.normalized_email<>t.normalized_email)
            then v_phone else t.normalized_phone end,
          updated_at=v_now
      where t.normalized_email=v_identity.normalized_email;
    end if;

    select t.pro_trial_started_at,t.pro_trial_ends_at into v_start,v_end
    from private.subscription_trial_identities t
    where (v_email is not null and t.normalized_email=v_email)
       or (v_phone is not null and t.normalized_phone=v_phone)
    order by t.pro_trial_started_at
    limit 1;
  end if;

  insert into public.dealership_subscriptions
    (dealership_id,user_id,status,pro_trial_ends_at,trial_used,amount,currency,updated_at)
  values (p_dealership_id,v_user_id,'inactive',case when v_has_prior then null else v_end end,true,3.99,'USD',v_now)
  on conflict (dealership_id) do update
    set pro_trial_ends_at=coalesce(public.dealership_subscriptions.pro_trial_ends_at,excluded.pro_trial_ends_at),
        updated_at=v_now;

  return jsonb_build_object(
    'pro_trial_started',not v_has_prior,
    'pro_trial_ends_at',case when v_has_prior then null else v_end end
  );
end;
$$;

create or replace function private.start_pro_trial_after_dealership_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.start_pro_trial_for_dealership(new.id);
  return new;
end;
$$;

-- Remove both legacy three-day dealership insert triggers and the sign-in retry.
drop trigger if exists dealerships_start_trial on public.dealerships;
drop trigger if exists dealerships_auto_start_trial on public.dealerships;
drop trigger if exists auth_users_retry_dealership_trial on auth.users;
drop trigger if exists auth_user_record_signup_trial on auth.users;

drop trigger if exists dealerships_auto_start_pro_trial on public.dealerships;
create trigger dealerships_auto_start_pro_trial
after insert on public.dealerships
for each row execute function private.start_pro_trial_after_dealership_insert();

-- Retire the old client-callable three-day activation RPC.
revoke all on function public.activate_dealership_trial() from public, anon, authenticated;

-- Enforce Free/Pro vehicle and photo caps at the database boundary.
create or replace function private.enforce_vehicle_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text := private.dealership_plan(new.dealership_id);
  v_vehicle_limit integer := case when v_plan='pro' then null else 3 end;
  v_photo_limit integer := case when v_plan='pro' then 10 else 5 end;
  v_count integer;
begin
  if tg_op='INSERT' then
    if v_vehicle_limit is not null then
      select count(*) into v_count from public.vehicles
      where dealership_id=new.dealership_id and status<>'hidden';
      if v_count>=v_vehicle_limit then
        raise exception 'PLAN_LIMIT_VEHICLES' using errcode='23514',detail='Free plan supports up to 3 vehicles.';
      end if;
    end if;
    if coalesce(array_length(new.photos,1),0)>v_photo_limit then
      raise exception 'PLAN_LIMIT_PHOTOS' using errcode='23514',detail='Free plan supports up to 5 photos per vehicle.';
    end if;
  elsif new.photos is distinct from old.photos then
    if coalesce(array_length(new.photos,1),0)>v_photo_limit then
      raise exception 'PLAN_LIMIT_PHOTOS' using errcode='23514',detail='Your current plan photo limit has been reached.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_enforce_plan_limits on public.vehicles;
create trigger vehicles_enforce_plan_limits
before insert or update of photos on public.vehicles
for each row execute function private.enforce_vehicle_plan_limits();

-- Storage writes are ownership-only. The vehicle photo cap is enforced when
-- photo URLs are attached to a vehicle row by the trigger above.
drop policy if exists "Subscribed dealers upload vehicle photos" on storage.objects;
create policy "Dealers upload own vehicle photos"
on storage.objects for insert to authenticated
with check (
  bucket_id='vehicle-photos'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers update vehicle photos" on storage.objects;
create policy "Dealers update own vehicle photos"
on storage.objects for update to authenticated
using (
  bucket_id='vehicle-photos'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
)
with check (
  bucket_id='vehicle-photos'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers delete vehicle photos" on storage.objects;
create policy "Dealers delete own vehicle photos"
on storage.objects for delete to authenticated
using (
  bucket_id='vehicle-photos'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers upload dealership assets" on storage.objects;
create policy "Dealers upload own dealership assets"
on storage.objects for insert to authenticated
with check (
  bucket_id='dealership-assets'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers update dealership assets" on storage.objects;
create policy "Dealers update own dealership assets"
on storage.objects for update to authenticated
using (
  bucket_id='dealership-assets'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
)
with check (
  bucket_id='dealership-assets'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers delete dealership assets" on storage.objects;
create policy "Dealers delete own dealership assets"
on storage.objects for delete to authenticated
using (
  bucket_id='dealership-assets'
  and exists(select 1 from public.dealerships d
    where d.id::text=(storage.foldername(name))[1]
      and d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers upload DriveLink assets" on storage.objects;
create policy "Dealers upload own DriveLink assets"
on storage.objects for insert to authenticated
with check (
  bucket_id='drivelink-assets'
  and exists(select 1 from public.dealerships d where d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers update DriveLink assets" on storage.objects;
create policy "Dealers update own DriveLink assets"
on storage.objects for update to authenticated
using (
  bucket_id='drivelink-assets'
  and exists(select 1 from public.dealerships d where d.user_id=(select auth.uid()))
)
with check (
  bucket_id='drivelink-assets'
  and exists(select 1 from public.dealerships d where d.user_id=(select auth.uid()))
);

drop policy if exists "Subscribed dealers delete DriveLink assets" on storage.objects;
create policy "Dealers delete own DriveLink assets"
on storage.objects for delete to authenticated
using (
  bucket_id='drivelink-assets'
  and exists(select 1 from public.dealerships d where d.user_id=(select auth.uid()))
);

-- Pro-trial reminder notifications. Existing notification scheduler delivers these.
create or replace function public.enqueue_pro_trial_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer := 0;
begin
  insert into public.notifications(dealership_id,category,title,body,data,dedupe_key)
  select s.dealership_id,'subscription','Your Pro trial ends in 3 days',
         'Keep unlimited vehicles and full analytics by upgrading to Lotlé Pro.',
         jsonb_build_object('type','pro_trial_3_day','route','/app/billing'),'pro-trial-3-day:'||s.dealership_id::text
  from public.dealership_subscriptions s
  where s.pro_trial_ends_at > pg_catalog.now()+interval '2 days'
    and s.pro_trial_ends_at <= pg_catalog.now()+interval '3 days'
    and not exists(select 1 from public.notifications n where n.dedupe_key='pro-trial-3-day:'||s.dealership_id::text);
  get diagnostics v_count = row_count;

  insert into public.notifications(dealership_id,category,title,body,data,dedupe_key)
  select s.dealership_id,'subscription','Your Pro trial ends today',
         'Your showroom stays on the Free plan. Upgrade any time to restore Pro features.',
         jsonb_build_object('type','pro_trial_ends_today','route','/app/billing'),'pro-trial-ended:'||s.dealership_id::text
  from public.dealership_subscriptions s
  where s.pro_trial_ends_at <= pg_catalog.now()
    and s.pro_trial_ends_at > pg_catalog.now()-interval '1 day'
    and not exists(select 1 from public.notifications n where n.dedupe_key='pro-trial-ended:'||s.dealership_id::text);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute $q$select cron.schedule('lotle-pro-trial-reminders','15 * * * *','select public.enqueue_pro_trial_reminders();')$q$;
  end if;
end;
$$;
