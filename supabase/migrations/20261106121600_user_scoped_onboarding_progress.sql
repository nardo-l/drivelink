-- Store onboarding progress and draft data per authenticated account.
create table if not exists public.user_onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 9),
  draft jsonb not null default '{}'::jsonb,
  intro_completed boolean not null default false,
  notifications_prompt_dismissed_at timestamptz,
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding_progress enable row level security;
drop policy if exists "Users manage their own onboarding progress" on public.user_onboarding_progress;
create policy "Users manage their own onboarding progress"
on public.user_onboarding_progress
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_onboarding_progress to authenticated;
revoke all on public.user_onboarding_progress from anon;

-- Keep existing completed accounts completed during migration.
insert into public.user_onboarding_progress
  (user_id, onboarding_step, onboarding_completed_at, intro_completed, updated_at)
select d.user_id, 9, d.onboarding_completed_at, true, now()
from public.dealerships d
where d.onboarding_completed_at is not null
on conflict (user_id) do update
set onboarding_step = 9,
    onboarding_completed_at = coalesce(public.user_onboarding_progress.onboarding_completed_at, excluded.onboarding_completed_at),
    intro_completed = true,
    updated_at = now();
