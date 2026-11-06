alter table public.user_onboarding_progress
  add column if not exists notifications_enabled boolean not null default false;
