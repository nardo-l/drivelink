-- Step-by-step diagnostics and safe retries for dealership onboarding.
-- This migration is intentionally repeatable and does not change billing terms or payment logic.

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create schema if not exists private;

create or replace function private.normalize_dealership_slug(p_value text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(extensions.unaccent(coalesce(p_value, ''))), '[^a-z0-9]+', '-', 'g'),
    '-{2,}', '-', 'g'
  ));
$$;

create unique index if not exists dealerships_user_id_uidx
  on public.dealerships(user_id);

create or replace function public.complete_dealership_onboarding(p_dealership jsonb)
returns public.dealerships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.dealerships%rowtype;
  v_dealer public.dealerships%rowtype;
  v_base_slug text;
  v_candidate text;
  v_suffix integer := 1;
  v_constraint text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_step text := 'dealership_lookup';
  v_state text;
  v_message text;
  v_detail text;
  v_hint text;
  v_context text;
begin
  raise log '[onboarding][dealership_lookup] Starting dealership lookup for user %', v_user_id;
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_dealership is null or jsonb_typeof(p_dealership) <> 'object' then
    raise exception 'Dealership details are required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('dealership-owner:' || v_user_id::text, 0)
  );

  select * into v_existing
  from public.dealerships
  where user_id = v_user_id
  order by created_at asc
  limit 1
  for update;

  if found then
    v_step := 'dealership_update';
    raise log '[onboarding][dealership_update] Reusing existing dealership % for user %', v_existing.id, v_user_id;
    update public.dealerships
    set name = coalesce(nullif(btrim(p_dealership->>'name'), ''), name),
        country = coalesce(nullif(p_dealership->>'country', ''), country),
        city = nullif(btrim(coalesce(p_dealership->>'city', city)), ''),
        address = nullif(btrim(coalesce(p_dealership->>'address', address)), ''),
        phone = nullif(coalesce(p_dealership->>'phone', phone), ''),
        whatsapp = nullif(coalesce(p_dealership->>'whatsapp', whatsapp), ''),
        email = coalesce(nullif(p_dealership->>'email', ''), email),
        currency = coalesce(nullif(p_dealership->>'currency', ''), currency),
        template = coalesce(nullif(p_dealership->>'template', ''), template),
        dealership_type = coalesce(nullif(p_dealership->>'dealership_type', ''), dealership_type),
        tagline = coalesce(nullif(p_dealership->>'tagline', ''), tagline),
        logo_url = coalesce(nullif(p_dealership->>'logo_url', ''), logo_url),
        cover_url = coalesce(nullif(p_dealership->>'cover_url', ''), cover_url),
        banner_url = coalesce(nullif(p_dealership->>'banner_url', ''), banner_url),
        is_published = coalesce((p_dealership->>'is_published')::boolean, is_published),
        updated_at = v_now
    where id = v_existing.id
    returning * into v_dealer;
  else
    v_step := 'slug_generation';
    raise log '[onboarding][slug_generation] Normalizing requested slug for user %', v_user_id;
    v_base_slug := private.normalize_dealership_slug(
      coalesce(nullif(p_dealership->>'slug', ''), p_dealership->>'name', 'showroom')
    );
    if v_base_slug = '' then v_base_slug := 'showroom'; end if;
    if v_base_slug in ('login','signup','dashboard','settings','billing','api','admin','cars','lotle') then
      v_base_slug := v_base_slug || '-showroom';
    end if;
    v_base_slug := left(v_base_slug, 63);
    v_candidate := v_base_slug;

    loop
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('dealership-slug:' || v_candidate, 0)
      );
      begin
        v_step := 'dealership_insert';
        raise log '[onboarding][dealership_insert] Attempting slug % for user %', v_candidate, v_user_id;
        insert into public.dealerships
          (user_id, name, slug, country, city, address, phone, whatsapp, email,
           currency, template, dealership_type, tagline, logo_url, cover_url,
           banner_url, is_published, updated_at)
        values
          (v_user_id,
           coalesce(nullif(btrim(p_dealership->>'name'), ''), 'My Dealership'),
           v_candidate,
           coalesce(nullif(p_dealership->>'country', ''), 'Zimbabwe'),
           nullif(btrim(p_dealership->>'city'), ''),
           nullif(btrim(p_dealership->>'address'), ''),
           nullif(p_dealership->>'phone', ''),
           nullif(p_dealership->>'whatsapp', ''),
           coalesce(nullif(p_dealership->>'email', ''), (select email from auth.users where id = v_user_id)),
           coalesce(nullif(p_dealership->>'currency', ''), 'USD'),
           coalesce(nullif(p_dealership->>'template', ''), 'signature'),
           coalesce(nullif(p_dealership->>'dealership_type', ''), 'dealership'),
           nullif(p_dealership->>'tagline', ''),
           nullif(p_dealership->>'logo_url', ''),
           nullif(p_dealership->>'cover_url', ''),
           nullif(p_dealership->>'banner_url', ''),
           coalesce((p_dealership->>'is_published')::boolean, true),
           v_now)
        returning * into v_dealer;
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint <> 'dealerships_slug_key' then
          raise;
        end if;
        raise log '[onboarding][slug_generation] Requested slug % is already used; generating suffix', v_candidate;
        v_suffix := v_suffix + 1;
        v_candidate := left(v_base_slug, 63 - length('-' || v_suffix::text)) || '-' || v_suffix::text;
      end;
    end loop;
  end if;

  v_step := 'trial_start';
  raise log '[onboarding][trial_start] Attempting idempotent trial activation for user %', v_user_id;
  begin
    perform private.activate_dealership_trial_for_user(v_user_id);
    raise log '[onboarding][trial_start] Trial activation completed for user %', v_user_id;
  exception when others then
    get stacked diagnostics
      v_state = returned_sqlstate,
      v_message = message_text,
      v_detail = pg_exception_detail,
      v_hint = pg_exception_hint,
      v_context = pg_exception_context;
    raise log '[onboarding][trial_start] Non-blocking trial failure for user %: SQLSTATE %, message %, detail %, hint %, context %',
      v_user_id, v_state, v_message, v_detail, v_hint, v_context;
  end;

  v_step := 'onboarding_completion';
  raise log '[onboarding][onboarding_completion] Persisting completion for dealership % and user %', v_dealer.id, v_user_id;
  update public.dealerships
  set onboarding_completed_at = coalesce(onboarding_completed_at, v_now)
  where id = v_dealer.id
  returning * into v_dealer;

  insert into public.user_onboarding_progress
    (user_id, onboarding_step, intro_completed, onboarding_completed_at, updated_at)
  values (v_user_id, 7, true, v_now, v_now)
  on conflict (user_id) do update set
    onboarding_step = greatest(coalesce(public.user_onboarding_progress.onboarding_step, 0), 7),
    intro_completed = true,
    onboarding_completed_at = coalesce(public.user_onboarding_progress.onboarding_completed_at, v_now),
    updated_at = v_now;

  raise log '[onboarding][onboarding_completion] Completed setup for dealership % and user %', v_dealer.id, v_user_id;
  return v_dealer;
exception when others then
  get stacked diagnostics
    v_state = returned_sqlstate,
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint,
    v_context = pg_exception_context;
  raise log '[onboarding][%] Failed for user %: SQLSTATE %, message %, detail %, hint %, context %',
    v_step, v_user_id, v_state, v_message, v_detail, v_hint, v_context;
  raise;
end;
$$;

revoke all on function public.complete_dealership_onboarding(jsonb) from public, anon;
grant execute on function public.complete_dealership_onboarding(jsonb) to authenticated;
