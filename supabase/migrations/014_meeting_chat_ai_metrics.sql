




-- Migration 015 — Meeting chat AI telemetry
--
-- Append-only operational metrics for the meeting RAG chat pipeline. The app
-- writes one event row per chat answer attempt through the service role.

create table if not exists meeting_chat_ai_metrics (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references meeting_chats on delete cascade,
  meeting_id uuid not null references meetings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null check (status in ('completed', 'failed')),
  fallback_reason text,
  embedding_model text not null,
  answer_model text not null,
  retrieved_chunks_count integer not null default 0
    check (retrieved_chunks_count >= 0),
  max_similarity double precision
    check (max_similarity is null or (max_similarity >= -1 and max_similarity <= 1)),
  avg_similarity double precision
    check (avg_similarity is null or (avg_similarity >= -1 and avg_similarity <= 1)),
  question_tokens_estimated integer not null default 0
    check (question_tokens_estimated >= 0),
  context_tokens_estimated integer not null default 0
    check (context_tokens_estimated >= 0),
  answer_tokens_estimated integer not null default 0
    check (answer_tokens_estimated >= 0),
  embedding_duration_ms integer
    check (embedding_duration_ms is null or embedding_duration_ms >= 0),
  retrieval_duration_ms integer
    check (retrieval_duration_ms is null or retrieval_duration_ms >= 0),
  generation_duration_ms integer
    check (generation_duration_ms is null or generation_duration_ms >= 0),
  total_duration_ms integer not null
    check (total_duration_ms >= 0),
  estimated_cost_usd numeric(12, 8) not null default 0
    check (estimated_cost_usd >= 0),
  created_at timestamptz default now()
);

create index if not exists idx_meeting_chat_ai_metrics_user_created_at
  on meeting_chat_ai_metrics(user_id, created_at desc);

create index if not exists idx_meeting_chat_ai_metrics_meeting_created_at
  on meeting_chat_ai_metrics(meeting_id, created_at desc);

create index if not exists idx_meeting_chat_ai_metrics_chat_id
  on meeting_chat_ai_metrics(chat_id);

create index if not exists idx_meeting_chat_ai_metrics_status_created_at
  on meeting_chat_ai_metrics(status, created_at desc);

alter table meeting_chat_ai_metrics enable row level security;

revoke all on table meeting_chat_ai_metrics from authenticated;
revoke all on table meeting_chat_ai_metrics from anon;
revoke all on table meeting_chat_ai_metrics from public;

grant all on table meeting_chat_ai_metrics to service_role;
