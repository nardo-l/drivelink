-- Retry trial setup at sign-in only for users who have reached the final
-- onboarding step. Do not alter genuinely mid-onboarding dealership accounts.
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
  v_onboarding_complete boolean := false;
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    select exists (
      select 1 from public.dealerships d
      where d.user_id = new.id and d.onboarding_completed_at is not null
    ) or exists (
      select 1 from public.user_onboarding_progress p
      where p.user_id = new.id
        and (p.onboarding_completed_at is not null or coalesce(p.onboarding_step, 0) >= 6)
    ) into v_onboarding_complete;

    if v_onboarding_complete then
      perform private.activate_dealership_trial_for_user(new.id);
    end if;
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

revoke all on function private.retry_dealership_trial_after_sign_in() from public, anon, authenticated;
revoke all on function private.start_dealership_trial_after_insert() from public, anon, authenticated;
