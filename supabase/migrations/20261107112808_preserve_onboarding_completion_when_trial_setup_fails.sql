-- Keep the onboarding completion marker even if the automatic trial setup
-- trigger encounters a transient failure. The next load/sign-in retries trial setup.
create or replace function private.start_dealership_trial_after_insert()
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
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  perform private.activate_dealership_trial_for_user(new.user_id);
  return new;
exception when others then
  get stacked diagnostics
    v_message = message_text,
    v_detail = pg_exception_detail,
    v_hint = pg_exception_hint,
    v_context = pg_exception_context,
    v_state = returned_sqlstate;

  begin
    insert into public.user_onboarding_progress
      (user_id, onboarding_step, intro_completed, onboarding_completed_at, updated_at)
    values (new.user_id, 7, true, v_now, v_now)
    on conflict (user_id) do update set
      onboarding_step = greatest(coalesce(public.user_onboarding_progress.onboarding_step, 0), 7),
      intro_completed = true,
      onboarding_completed_at = coalesce(public.user_onboarding_progress.onboarding_completed_at, v_now),
      updated_at = v_now;
  exception when others then
    raise log 'Could not persist onboarding completion after trial setup failure for user %: %',
      new.user_id, sqlerrm;
  end;

  raise log 'Automatic trial setup failed for dealership % (user %): SQLSTATE %, message %, detail %, hint %, context %',
    new.id, new.user_id, v_state, v_message, v_detail, v_hint, v_context;
  return new;
end;
$$;

revoke all on function private.start_dealership_trial_after_insert() from public, anon, authenticated;
