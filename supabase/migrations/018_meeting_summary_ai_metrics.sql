-- Migration 018 - Meeting summary AI telemetry
--
-- Append-only operational metrics for meeting summarization. This mirrors the
-- chat AI metrics table enough to answer which model generated a summary and
-- whether the fallback model was used.

create table if not exists meeting_summary_ai_metrics (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null check (status in ('processing', 'completed', 'failed')),
  request_id text,
  stage text not null default 'created',
  error_message text,
  primary_model text not null,
  fallback_model text,
  summary_model text not null,
  used_fallback boolean not null default false,
  prompt_version text not null,
  transcript_tokens_estimated integer not null default 0
    check (transcript_tokens_estimated >= 0),
  summary_tokens_estimated integer not null default 0
    check (summary_tokens_estimated >= 0),
  generation_duration_ms integer
    check (generation_duration_ms is null or generation_duration_ms >= 0),
  total_duration_ms integer not null
    check (total_duration_ms >= 0),
  estimated_cost_usd numeric(12, 8) not null default 0
    check (estimated_cost_usd >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists idx_meeting_summary_ai_metrics_user_created_at
  on meeting_summary_ai_metrics(user_id, created_at desc);

create index if not exists idx_meeting_summary_ai_metrics_meeting_created_at
  on meeting_summary_ai_metrics(meeting_id, created_at desc);

create index if not exists idx_meeting_summary_ai_metrics_request_id
  on meeting_summary_ai_metrics(request_id);

create index if not exists idx_meeting_summary_ai_metrics_status_created_at
  on meeting_summary_ai_metrics(status, created_at desc);

alter table meeting_summary_ai_metrics enable row level security;

revoke all on table meeting_summary_ai_metrics from authenticated;
revoke all on table meeting_summary_ai_metrics from anon;
revoke all on table meeting_summary_ai_metrics from public;

grant all on table meeting_summary_ai_metrics to service_role;
