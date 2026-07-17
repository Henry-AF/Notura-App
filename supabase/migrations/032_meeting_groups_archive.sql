-- Allows meeting groups to be archived (reversible) instead of only hard-deleted.

alter table public.meeting_groups
  add column if not exists archived_at timestamptz null;

create index if not exists idx_meeting_groups_active
  on public.meeting_groups(user_id, created_at desc)
  where archived_at is null;
