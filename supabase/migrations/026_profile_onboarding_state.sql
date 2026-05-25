alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_phase integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_onboarding_phase_check'
  ) then
    alter table public.profiles
      add constraint profiles_onboarding_phase_check
      check (onboarding_phase between 0 and 2);
  end if;
end $$;
