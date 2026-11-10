-- Apply the existing four notification preference categories to in-app inserts.
-- Payment confirmations are always retained in the Lotlé inbox.

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

  select new_enquiries, vehicle_reminders, daily_summary, subscription_reminders
  into preferences
  from public.notification_preferences
  where dealership_id = new.dealership_id;

  if not found then
    return new;
  end if;

  if new.category = 'enquiry' and preferences.new_enquiries is false then
    return null;
  end if;
  if new.category in ('inventory', 'showroom') and preferences.vehicle_reminders is false then
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

drop trigger if exists notifications_filter_preferences on public.notifications;
create trigger notifications_filter_preferences
  before insert on public.notifications
  for each row execute function public.filter_lotle_notification_preferences();
revoke all on function public.filter_lotle_notification_preferences() from public, anon, authenticated;
