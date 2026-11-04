-- Track whether a dealer dismissed the initial browser notification prompt.
alter table public.notification_preferences
  add column if not exists notifications_prompt_dismissed_at timestamptz;
