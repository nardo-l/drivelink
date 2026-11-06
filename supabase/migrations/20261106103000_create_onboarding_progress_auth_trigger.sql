create or replace function public.create_user_onboarding_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_user_onboarding_progress() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_onboarding_progress on auth.users;
create trigger on_auth_user_created_onboarding_progress
after insert on auth.users
for each row execute function public.create_user_onboarding_progress();
