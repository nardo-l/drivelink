-- Optional alternative to the Pro-trial backfill.
-- Use this only if existing dealerships should start on Free instead of receiving
-- a first 14-day Pro trial. Paid subscriptions with a future paid period are kept.
-- Safe to run repeatedly; it never deletes vehicles, photos, enquiries or payments.
do $$
declare
  r record;
  v_now timestamptz := pg_catalog.now();
  v_phone text;
begin
  for r in
    select d.id as dealership_id, d.user_id,
           lower(pg_catalog.btrim(u.email)) as email,
           nullif(pg_catalog.regexp_replace(coalesce(nullif(d.phone,''),nullif(d.whatsapp,''),''),'[^0-9]','','g'),'') as phone
    from public.dealerships d
    join auth.users u on u.id=d.user_id
    where u.email is not null
    order by d.created_at
  loop
    v_phone := case when r.phone is not null and pg_catalog.length(r.phone)>=7 then r.phone else null end;

    insert into private.subscription_trial_identities
      (normalized_email,auth_user_id,trial_started_at,trial_ends_at,pro_trial_started_at,pro_trial_ends_at)
    values
      (r.email,r.user_id,v_now,v_now+interval '72 hours',v_now,v_now)
    on conflict (normalized_email) do update
      set pro_trial_started_at=coalesce(private.subscription_trial_identities.pro_trial_started_at,v_now),
          pro_trial_ends_at=least(coalesce(private.subscription_trial_identities.pro_trial_ends_at,v_now),v_now),
          auth_user_id=coalesce(private.subscription_trial_identities.auth_user_id,excluded.auth_user_id),
          updated_at=v_now;

    -- If this phone identity exists but has never had a Pro trial, mark it used
    -- as Free so a different email cannot claim a second trial on the same phone.
    if v_phone is not null then
      update private.subscription_trial_identities
        set pro_trial_started_at=coalesce(pro_trial_started_at,v_now),
            pro_trial_ends_at=least(coalesce(pro_trial_ends_at,v_now),v_now),
            updated_at=v_now
      where normalized_phone=v_phone and pro_trial_started_at is null;
    end if;

    -- Attach the phone only if it is not already claimed by a different email.
    if v_phone is not null and not exists (
      select 1 from private.subscription_trial_identities t
      where t.normalized_phone=v_phone and t.normalized_email<>r.email
    ) then
      update private.subscription_trial_identities
        set normalized_phone=v_phone,
            pro_trial_started_at=coalesce(pro_trial_started_at,v_now),
            pro_trial_ends_at=least(coalesce(pro_trial_ends_at,v_now),v_now),
            updated_at=v_now
      where normalized_email=r.email;
    end if;

    update public.dealership_subscriptions
      set pro_trial_ends_at=null,updated_at=v_now
    where dealership_id=r.dealership_id
      and not (status='active' and current_period_end>v_now);
  end loop;
end;
$$;
