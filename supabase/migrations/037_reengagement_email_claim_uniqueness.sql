-- NOT-203: atomically prevent duplicate 48h reengagement sends.
-- One inactivity period (identified by the last meeting) may be claimed once.
with duplicate_claims as (
  select
    id,
    row_number() over (
      partition by user_id, trigger_type, last_meeting_at
      order by sent_at, id
    ) as claim_number
  from public.reengagement_log
)
delete from public.reengagement_log log
using duplicate_claims duplicate
where log.id = duplicate.id
  and duplicate.claim_number > 1;

create unique index if not exists idx_reengagement_log_unique_claim
  on public.reengagement_log (user_id, trigger_type, last_meeting_at);

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
        and log.last_meeting_at = latest.last_meeting_at
    );
$$;
