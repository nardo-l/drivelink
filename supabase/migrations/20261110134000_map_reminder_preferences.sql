-- Map all legacy reminder switches into the single Lotlé Reminders category.

create or replace function public.filter_lotle_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  preferences record;
begin
  if new.data->>'eventId' = 'payment_confirmed' then
    return new;
  end if;

  select new_enquiries, vehicle_reminders, share_reminders,
         showroom_activity, daily_summary, subscription_reminders
  into preferences
  from public.notification_preferences
  where dealership_id = new.dealership_id;

  if not found then
    return new;
  end if;

  if new.category = 'enquiry' and preferences.new_enquiries is false then
    return null;
  end if;
  if new.category = 'inventory' and preferences.vehicle_reminders is false then
    return null;
  end if;
  if new.category = 'sharing' and preferences.share_reminders is false then
    return null;
  end if;
  if new.category = 'showroom' and preferences.showroom_activity is false then
    return null;
  end if;
  if new.category = 'daily_summary' and preferences.daily_summary is false then
    return null;
  end if;
  if new.category = 'subscription' and preferences.subscription_reminders is false then
    return null;
  end if;

  return new;
end;
$function$;
