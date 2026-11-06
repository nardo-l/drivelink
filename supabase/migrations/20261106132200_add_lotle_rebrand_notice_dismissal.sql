alter table public.user_onboarding_progress
  add column if not exists brand_notice_dismissed_at timestamptz;
