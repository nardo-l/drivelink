-- Optional one-time backfill for existing dealerships.
-- Grants the 14-day Pro trial only where neither the email nor phone has ever
-- claimed a Pro trial. Safe to run repeatedly; never resets an existing Pro trial.
do $$
declare r record;
begin
  for r in
    select d.id
    from public.dealerships d
    join auth.users u on u.id=d.user_id
    where u.email is not null
    order by d.created_at
  loop
    perform private.start_pro_trial_for_dealership(r.id);
  end loop;
end;
$$;

-- To leave all existing dealerships on Free instead, run this alternative
-- instead of the DO block above. It does not touch paid active subscriptions:
-- update public.dealership_subscriptions
-- set pro_trial_ends_at = null, updated_at = now()
-- where status <> 'active' or current_period_end is null or current_period_end <= now();
