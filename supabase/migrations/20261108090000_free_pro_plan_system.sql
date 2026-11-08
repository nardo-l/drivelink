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

-- Public showroom access remains available on Free when the dealership is published.
create or replace function private.dealership_has_public_access(p_dealership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.dealerships d
    where d.id = p_dealership_id and d.is_published = true
  );
$;

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
  -- Existing accounts are assigned by the explicit repair script; new accounts
  -- receive Pro automatically from the dealership-insert trigger.
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

create or replace function public.choose_free_plan_vehicles(p_vehicle_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $
declare v_dealership_id uuid;
  v_vehicle_limit integer := (private.plan_config() -> 'free' ->> 'maxVehicles')::integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if coalesce(cardinality(p_vehicle_ids),0)>v_vehicle_limit then
    raise exception 'PLAN_LIMIT_VEHICLES' using errcode='23514';
  end if;
  select d.id into v_dealership_id from public.dealerships d
  where d.user_id=auth.uid() order by d.created_at desc limit 1;
  if v_dealership_id is null then raise exception 'Dealership not found' using errcode='P0002'; end if;
  if private.dealership_plan(v_dealership_id)<>'free' then
    raise exception 'Vehicle picker is only available on the Free plan';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_vehicle_ids,'{}'::uuid[])) requested(id)
    where not exists(select 1 from public.vehicles v where v.id=requested.id and v.dealership_id=v_dealership_id)
  ) then raise exception 'A selected vehicle does not belong to this dealership' using errcode='42501'; end if;

  update public.vehicles v
    set status=coalesce(v.plan_hidden_status,v.status),
        plan_hidden_status=null,
        updated_at=pg_catalog.now()
  where v.dealership_id=v_dealership_id and v.id=any(coalesce(p_vehicle_ids,'{}'::uuid[]));

  update public.vehicles v
    set plan_hidden_status=coalesce(v.plan_hidden_status,v.status),
        status='hidden',
        updated_at=pg_catalog.now()
  where v.dealership_id=v_dealership_id
    and v.status<>'hidden'
    and not (v.id=any(coalesce(p_vehicle_ids,'{}'::uuid[])));
end;
$;

revoke all on function public.choose_free_plan_vehicles(uuid[]) from public,anon;
grant execute on function public.choose_free_plan_vehicles(uuid[]) to authenticated;

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
  if v_email is null or v_email='' then
    raise exception 'A valid account email is required to claim a Pro trial.' using errcode='22023';
  end if;
  if v_phone is not null and pg_catalog.length(v_phone)<7 then v_phone:=null; end if;

  if exists(
    select 1 from public.dealership_subscriptions sub
    where sub.dealership_id=p_dealership_id
      and sub.status='active'
      and sub.current_period_end>v_now
  ) then
    return jsonb_build_object('pro_trial_started',false,'reason','already_paid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pro-email:'||v_email,0));
  if v_phone is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pro-phone:'||v_phone,0));
  end if;

  select exists(
    select 1 from private.subscription_trial_identities t
    where (t.normalized_email=v_email or (v_phone is not null and t.normalized_phone=v_phone))
      and t.pro_trial_started_at is not null
  ) into v_has_prior;

  if v_has_prior then
    select t.pro_trial_started_at,t.pro_trial_ends_at
      into v_start,v_end
    from private.subscription_trial_identities t
    where (t.normalized_email=v_email or (v_phone is not null and t.normalized_phone=v_phone))
      and t.pro_trial_started_at is not null
    order by t.pro_trial_started_at,t.created_at
    limit 1
    for update;
  else
    v_start:=v_now;
    v_end:=v_now+interval '14 days';
  end if;

  -- Always stamp both identity keys with the same first Pro-trial claim.
  -- This closes the email-already-seen / phone-already-seen cross-account gap.
  insert into private.subscription_trial_identities
    (normalized_email,auth_user_id,trial_started_at,trial_ends_at,pro_trial_started_at,pro_trial_ends_at)
  values (v_email,v_user_id,v_now,v_now+interval '72 hours',v_start,v_end)
  on conflict (normalized_email) do update
    set pro_trial_started_at=coalesce(private.subscription_trial_identities.pro_trial_started_at,excluded.pro_trial_started_at),
        pro_trial_ends_at=coalesce(private.subscription_trial_identities.pro_trial_ends_at,excluded.pro_trial_ends_at),
        auth_user_id=coalesce(private.subscription_trial_identities.auth_user_id,excluded.auth_user_id),
        updated_at=v_now;

  if v_phone is not null then
    update private.subscription_trial_identities
      set pro_trial_started_at=coalesce(pro_trial_started_at,v_start),
          pro_trial_ends_at=coalesce(pro_trial_ends_at,v_end),
          updated_at=v_now
    where normalized_phone=v_phone;

    if not exists(select 1 from private.subscription_trial_identities where normalized_phone=v_phone) then
      update private.subscription_trial_identities
        set normalized_phone=v_phone,updated_at=v_now
      where normalized_email=v_email and normalized_phone is null;
    end if;
  end if;

  insert into public.dealership_subscriptions
    (dealership_id,user_id,status,pro_trial_ends_at,trial_used,amount,currency,updated_at)
  values (p_dealership_id,v_user_id,'inactive',v_end,true,3.99,'USD',v_now)
  on conflict (dealership_id) do update
    set pro_trial_ends_at=coalesce(public.dealership_subscriptions.pro_trial_ends_at,excluded.pro_trial_ends_at),
        updated_at=v_now;

  return jsonb_build_object(
    'pro_trial_started',not v_has_prior,
    'pro_trial_ends_at',v_end
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

create or replace function private.sync_pro_trial_identity_after_dealership_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  if new.phone is distinct from old.phone or new.whatsapp is distinct from old.whatsapp then
    perform private.start_pro_trial_for_dealership(new.id);
  end if;
  return new;
end;
$;

drop trigger if exists dealerships_sync_pro_trial_identity on public.dealerships;
create trigger dealerships_sync_pro_trial_identity
after update of phone,whatsapp on public.dealerships
for each row execute function private.sync_pro_trial_identity_after_dealership_update();

create or replace function private.preserve_pro_trial_on_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if new.email is distinct from old.email and old.email is not null and new.email is not null then
    select s.pro_trial_ends_at into v_end
    from public.dealerships d
    join public.dealership_subscriptions s on s.dealership_id=d.id
    where d.user_id=new.id and s.pro_trial_ends_at is not null
    order by d.created_at desc limit 1;
    if v_end is not null then
      v_start:=v_end-interval '14 days';
      insert into private.subscription_trial_identities
        (normalized_email,auth_user_id,trial_started_at,trial_ends_at,pro_trial_started_at,pro_trial_ends_at)
      values
        (lower(pg_catalog.btrim(new.email)),new.id,pg_catalog.now(),pg_catalog.now()+interval '72 hours',v_start,v_end)
      on conflict (normalized_email) do update
        set pro_trial_started_at=coalesce(private.subscription_trial_identities.pro_trial_started_at,excluded.pro_trial_started_at),
            pro_trial_ends_at=coalesce(private.subscription_trial_identities.pro_trial_ends_at,excluded.pro_trial_ends_at),
            updated_at=pg_catalog.now();
    end if;
  end if;
  return new;
end;
$;

drop trigger if exists auth_users_preserve_pro_trial_email on auth.users;
create trigger auth_users_preserve_pro_trial_email
after update of email on auth.users
for each row execute function private.preserve_pro_trial_on_email_change();

-- Remove both legacy three-day dealership insert triggers and the sign-in retry.
drop trigger if exists dealerships_start_trial on public.dealerships;
drop trigger if exists dealerships_auto_start_trial on public.dealerships;
drop trigger if exists auth_users_retry_dealership_trial on auth.users;
drop trigger if exists auth_user_record_signup_trial on auth.users;

drop trigger if exists dealerships_auto_start_pro_trial on public.dealerships;
create trigger dealerships_auto_start_pro_trial
after insert on public.dealerships
for each row execute function private.start_pro_trial_after_dealership_insert();

-- Replace the legacy onboarding RPC's swallowed three-day trial call.
-- Pro-trial provisioning is part of this same transaction and failures roll back setup.
create or replace function public.complete_dealership_onboarding(p_dealership jsonb)
returns public.dealerships
language plpgsql
security definer
set search_path = ''
as $
declare
  v_user_id uuid := auth.uid();
  v_existing public.dealerships%rowtype;
  v_dealer public.dealerships%rowtype;
  v_base_slug text;
  v_candidate text;
  v_suffix integer := 1;
  v_constraint text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_user_id is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_dealership is null or jsonb_typeof(p_dealership) <> 'object' then raise exception 'Dealership details are required.' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dealership-owner:' || v_user_id::text, 0));

  select * into v_existing from public.dealerships where user_id=v_user_id order by created_at asc limit 1 for update;
  if found then
    update public.dealerships
    set name=coalesce(nullif(btrim(p_dealership->>'name'),''),name),
        country=coalesce(nullif(p_dealership->>'country',''),country),
        city=nullif(btrim(coalesce(p_dealership->>'city',city)),''),
        address=nullif(btrim(coalesce(p_dealership->>'address',address)),''),
        phone=nullif(coalesce(p_dealership->>'phone',phone),''),
        whatsapp=nullif(coalesce(p_dealership->>'whatsapp',whatsapp),''),
        email=coalesce(nullif(p_dealership->>'email',''),email),
        currency=coalesce(nullif(p_dealership->>'currency',''),currency),
        template=coalesce(nullif(p_dealership->>'template',''),template),
        dealership_type=coalesce(nullif(p_dealership->>'dealership_type',''),dealership_type),
        tagline=coalesce(nullif(p_dealership->>'tagline',''),tagline),
        logo_url=coalesce(nullif(p_dealership->>'logo_url',''),logo_url),
        cover_url=coalesce(nullif(p_dealership->>'cover_url',''),cover_url),
        banner_url=coalesce(nullif(p_dealership->>'banner_url',''),banner_url),
        is_published=coalesce((p_dealership->>'is_published')::boolean,is_published),
        updated_at=v_now
    where id=v_existing.id returning * into v_dealer;
  else
    v_base_slug:=private.normalize_dealership_slug(coalesce(nullif(p_dealership->>'slug',''),p_dealership->>'name','showroom'));
    if v_base_slug='' then v_base_slug:='showroom'; end if;
    if v_base_slug in ('login','signup','dashboard','settings','billing','api','admin','cars','lotle') then v_base_slug:=v_base_slug||'-showroom'; end if;
    v_base_slug:=left(v_base_slug,63);
    v_candidate:=v_base_slug;
    loop
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dealership-slug:'||v_candidate,0));
      begin
        insert into public.dealerships(user_id,name,slug,country,city,address,phone,whatsapp,email,currency,template,dealership_type,tagline,logo_url,cover_url,banner_url,is_published,updated_at)
        values(v_user_id,coalesce(nullif(btrim(p_dealership->>'name'),''),'My Dealership'),v_candidate,
          coalesce(nullif(p_dealership->>'country',''),'Zimbabwe'),nullif(btrim(p_dealership->>'city'),''),
          nullif(btrim(p_dealership->>'address'),''),nullif(p_dealership->>'phone',''),nullif(p_dealership->>'whatsapp',''),
          coalesce(nullif(p_dealership->>'email',''),(select email from auth.users where id=v_user_id)),
          coalesce(nullif(p_dealership->>'currency',''),'USD'),coalesce(nullif(p_dealership->>'template',''),'signature'),
          coalesce(nullif(p_dealership->>'dealership_type',''),'dealership'),nullif(p_dealership->>'tagline',''),
          nullif(p_dealership->>'logo_url',''),nullif(p_dealership->>'cover_url',''),nullif(p_dealership->>'banner_url',''),
          coalesce((p_dealership->>'is_published')::boolean,true),v_now)
        returning * into v_dealer;
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint=constraint_name;
        if v_constraint is distinct from 'dealerships_slug_key' then raise; end if;
        v_suffix:=v_suffix+1;
        v_candidate:=left(v_base_slug,63-length('-'||v_suffix::text))||'-'||v_suffix::text;
      end;
    end loop;
  end if;

  perform private.start_pro_trial_for_dealership(v_dealer.id);
  update public.dealerships
    set onboarding_completed_at=coalesce(onboarding_completed_at,v_now)
    where id=v_dealer.id
    returning * into v_dealer;
  insert into public.user_onboarding_progress(user_id,onboarding_step,intro_completed,onboarding_completed_at,updated_at)
  values(v_user_id,7,true,v_now,v_now)
  on conflict(user_id) do update set
    onboarding_step=greatest(coalesce(public.user_onboarding_progress.onboarding_step,0),7),
    intro_completed=true,
    onboarding_completed_at=coalesce(public.user_onboarding_progress.onboarding_completed_at,v_now),
    updated_at=v_now;
  return v_dealer;
end;
$;

revoke all on function public.complete_dealership_onboarding(jsonb) from public,anon;
grant execute on function public.complete_dealership_onboarding(jsonb) to authenticated;

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
  v_vehicle_limit integer := nullif(private.plan_config() -> v_plan ->> 'maxVehicles','null')::integer;
  v_photo_limit integer := (private.plan_config() -> v_plan ->> 'maxPhotosPerVehicle')::integer;
  v_count integer;
begin
  if tg_op='INSERT' then
    if v_vehicle_limit is not null then
      select count(*) into v_count from public.vehicles
      where dealership_id=new.dealership_id and plan_hidden_status is null;
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

drop policy if exists "Subscribed dealers can upload DriveLink assets" on storage.objects;
-- DriveLink's shared static-assets bucket is service-managed; dealership users
-- do not receive broad write access to other users' or shared asset paths.

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
    and not (s.status='active' and s.current_period_end>pg_catalog.now())
    and not exists(select 1 from public.notifications n where n.dedupe_key='pro-trial-3-day:'||s.dealership_id::text);
  get diagnostics v_count = row_count;

  insert into public.notifications(dealership_id,category,title,body,data,dedupe_key)
  select s.dealership_id,'subscription','Your Pro trial ends today',
         'Your showroom stays on the Free plan. Upgrade any time to restore Pro features.',
         jsonb_build_object('type','pro_trial_ends_today','route','/app/billing'),'pro-trial-ended:'||s.dealership_id::text
  from public.dealership_subscriptions s
  where s.pro_trial_ends_at <= pg_catalog.now()
    and s.pro_trial_ends_at > pg_catalog.now()-interval '1 day'
    and not (s.status='active' and s.current_period_end>pg_catalog.now())
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
