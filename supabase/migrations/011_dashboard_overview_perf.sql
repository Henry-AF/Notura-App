-- Dashboard overview performance helpers
-- Reduces slow scans for dashboard entry queries.

create index if not exists idx_meetings_user_status_created_at
  on public.meetings (user_id, status, created_at desc);

create index if not exists idx_tasks_user_completed_created_at
  on public.tasks (user_id, completed, created_at desc);

create or replace function public.get_total_completed_meeting_seconds(p_user_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(duration_seconds), 0)::bigint
  from public.meetings
  where user_id = p_user_id
    and status = 'completed';
$$;
