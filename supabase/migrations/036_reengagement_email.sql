-- NOT-100: delivery log and candidate query for the 48h email reengagement.
create table if not exists public.reengagement_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  trigger_type text not null,
  variant text not null,
  last_meeting_at timestamptz not null
);

create index if not exists idx_reengagement_log_user_trigger_sent
  on public.reengagement_log (user_id, trigger_type, sent_at desc);

alter table public.reengagement_log enable row level security;

create or replace function public.get_reengagement_email_candidates()
returns table (
  user_id uuid,
  last_meeting_at timestamptz,
  days_since_last_meeting integer
)
language sql
security invoker
set search_path = ''
as $$
  with latest_completed as (
    select meetings.user_id, max(meetings.created_at) as last_meeting_at
    from public.meetings
    where meetings.status = 'completed'
    group by meetings.user_id
  )
  select
    latest.user_id,
    latest.last_meeting_at,
    floor(extract(epoch from (now() - latest.last_meeting_at)) / 86400)::integer
  from latest_completed latest
  where latest.last_meeting_at <= now() - interval '48 hours'
    and latest.last_meeting_at > now() - interval '7 days'
    and not exists (
      select 1
      from public.reengagement_log log
      where log.user_id = latest.user_id
        and log.trigger_type = 'meeting_inactive_48h'
        and log.sent_at > now() - interval '48 hours'
    );
$$;

revoke all on function public.get_reengagement_email_candidates() from public;
grant execute on function public.get_reengagement_email_candidates() to service_role;
revoke all on table public.reengagement_log from anon, authenticated;
