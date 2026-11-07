-- Backfill phone identity for trial records created before phone-based abuse protection.
with existing_trial_phones as (
  select distinct on (lower(btrim(u.email)))
    lower(btrim(u.email)) as normalized_email,
    nullif(pg_catalog.regexp_replace(
      coalesce(nullif(d.phone, ''), nullif(d.whatsapp, ''), ''),
      '[^0-9]', '', 'g'
    ), '') as normalized_phone
  from public.dealership_subscriptions s
  join public.dealerships d on d.id = s.dealership_id
  join auth.users u on u.id = s.user_id
  where s.trial_started_at is not null and u.email is not null
  order by lower(btrim(u.email)), d.created_at desc
)
update private.subscription_trial_identities t
set normalized_phone = p.normalized_phone,
    updated_at = pg_catalog.clock_timestamp()
from existing_trial_phones p
where t.normalized_email = p.normalized_email
  and t.normalized_phone is null
  and p.normalized_phone is not null
  and pg_catalog.length(p.normalized_phone) >= 7
  and not exists (
    select 1 from private.subscription_trial_identities other
    where other.normalized_phone = p.normalized_phone
  );
