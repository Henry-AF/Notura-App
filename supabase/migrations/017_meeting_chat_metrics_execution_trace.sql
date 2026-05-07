-- Migration 017 - Meeting chat metrics execution trace
--
-- Make meeting_chat_ai_metrics useful during incidents, not only after a
-- successful final insert. A row can now be created when the answer job starts
-- and updated as the job finishes.

alter table meeting_chat_ai_metrics
  drop constraint if exists meeting_chat_ai_metrics_status_check;

alter table meeting_chat_ai_metrics
  add constraint meeting_chat_ai_metrics_status_check
  check (status in ('processing', 'completed', 'failed'));

alter table meeting_chat_ai_metrics
  add column if not exists request_id text,
  add column if not exists stage text not null default 'created',
  add column if not exists error_message text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update meeting_chat_ai_metrics
set
  started_at = coalesce(started_at, created_at),
  completed_at = case
    when status in ('completed', 'failed') then coalesce(completed_at, created_at)
    else completed_at
  end,
  updated_at = coalesce(updated_at, created_at)
where started_at is null
   or updated_at is null
   or (status in ('completed', 'failed') and completed_at is null);

alter table meeting_chat_ai_metrics
  alter column started_at set default now();

create index if not exists idx_meeting_chat_ai_metrics_request_id
  on meeting_chat_ai_metrics(request_id);

create index if not exists idx_meeting_chat_ai_metrics_processing_updated_at
  on meeting_chat_ai_metrics(updated_at)
  where status = 'processing';
