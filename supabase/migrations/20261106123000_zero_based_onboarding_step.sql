alter table public.user_onboarding_progress
  alter column onboarding_step set default 0;

alter table public.user_onboarding_progress
  drop constraint if exists user_onboarding_progress_onboarding_step_check;

update public.user_onboarding_progress
set onboarding_step = case when onboarding_completed_at is not null then 7 else greatest(0, onboarding_step - 1) end;

alter table public.user_onboarding_progress
  add constraint user_onboarding_progress_onboarding_step_check
  check (onboarding_step between 0 and 7);
