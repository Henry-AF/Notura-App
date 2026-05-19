-- Meeting groups let users organize meetings without changing processing flow.

create table if not exists public.meeting_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_groups_name_not_blank check (char_length(trim(name)) > 0),
  constraint meeting_groups_name_length check (char_length(trim(name)) <= 80)
);

alter table public.meetings
  add column if not exists group_id uuid references public.meeting_groups(id) on delete set null;

create index if not exists idx_meeting_groups_user_id
  on public.meeting_groups(user_id, created_at desc);

create index if not exists idx_meetings_group_id
  on public.meetings(group_id)
  where group_id is not null;

alter table public.meeting_groups enable row level security;

drop policy if exists "meeting_groups_own_select" on public.meeting_groups;
drop policy if exists "meeting_groups_own_insert" on public.meeting_groups;
drop policy if exists "meeting_groups_own_update" on public.meeting_groups;
drop policy if exists "meeting_groups_own_delete" on public.meeting_groups;

create policy "meeting_groups_own_select"
  on public.meeting_groups for select
  using (auth.uid() = user_id);

create policy "meeting_groups_own_insert"
  on public.meeting_groups for insert
  with check (auth.uid() = user_id);

create policy "meeting_groups_own_update"
  on public.meeting_groups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "meeting_groups_own_delete"
  on public.meeting_groups for delete
  using (auth.uid() = user_id);

create or replace function public.touch_meeting_groups_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_meeting_groups_updated_at on public.meeting_groups;
create trigger touch_meeting_groups_updated_at
  before update on public.meeting_groups
  for each row
  execute function public.touch_meeting_groups_updated_at();

create or replace function public.enforce_meeting_group_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.group_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.meeting_groups
    where id = new.group_id
      and user_id = new.user_id
  ) then
    raise exception 'Meeting group does not belong to meeting owner'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_meeting_group_owner on public.meetings;
create trigger enforce_meeting_group_owner
  before insert or update of group_id, user_id on public.meetings
  for each row
  execute function public.enforce_meeting_group_owner();
