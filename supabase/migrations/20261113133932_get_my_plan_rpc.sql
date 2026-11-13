-- Add the authenticated plan snapshot RPC without replaying the superseded
-- Free/Pro migration. Preserve the existing three-day trial columns and billing flow.

create or replace function public.get_my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_dealership_id uuid;
  v_sub public.dealership_subscriptions%rowtype;
  v_plan text := 'free';
  v_config jsonb := jsonb_build_object(
    'free', jsonb_build_object(
      'maxVehicles', 3,
      'maxPhotosPerVehicle', 5,
      'analyticsCharts', false,
      'analyticsPeriods', jsonb_build_array(),
      'showPoweredBy', true,
      'supportLevel', 'standard'
    ),
    'pro', jsonb_build_object(
      'maxVehicles', null,
      'maxPhotosPerVehicle', 10,
      'analyticsCharts', true,
      'analyticsPeriods', jsonb_build_array(7, 30, 90),
      'showPoweredBy', false,
      'supportLevel', 'priority'
    ),
    'sharedFeatures', jsonb_build_object(
      'showroomLink', true,
      'landingPage', true,
      'logoAndBanner', true,
      'whatsapp', true,
      'enquiries', true,
      'enquiryPushNotifications', true
    )
  );
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select d.id
    into v_dealership_id
  from public.dealerships d
  where d.user_id = v_user_id
  order by d.created_at desc
  limit 1;

  if v_dealership_id is null then
    return jsonb_build_object(
      'plan', 'free',
      'pro_trial_ends_at', null,
      'current_period_end', null,
      'subscription_status', null,
      'dealership_id', null,
      'config', v_config
    );
  end if;

  select s.*
    into v_sub
  from public.dealership_subscriptions s
  where s.dealership_id = v_dealership_id;

  if (v_sub.status = 'active' and v_sub.current_period_end > pg_catalog.now())
     or v_sub.trial_ends_at > pg_catalog.now() then
    v_plan := 'pro';
  end if;

  return jsonb_build_object(
    'plan', v_plan,
    'pro_trial_ends_at', v_sub.trial_ends_at,
    'current_period_end', v_sub.current_period_end,
    'subscription_status', v_sub.status,
    'dealership_id', v_dealership_id,
    'config', v_config
  );
end;
$function$;

revoke all on function public.get_my_plan() from public, anon;
grant execute on function public.get_my_plan() to authenticated;
