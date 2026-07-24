-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 033 — job_checkpoints (NOT-69)
--
-- Checkpoints persistentes por etapa do job de processamento de reuniões.
-- Guarda o resultado das etapas caras (transcribe, lotes de embeddings,
-- summarize) para que um retry retome do ponto de falha sem re-chamar
-- AssemblyAI/Gemini.
--
-- Escopo por (meeting_id, step_name): cada run do job cria uma row nova em
-- `jobs`, então checkpoints por job_id nunca seriam encontrados por um retry
-- manual. `job_id` fica apenas como rastreabilidade.
--
-- Aplicar: Supabase SQL Editor ou `supabase db push`. Idempotente/re-runnable.
-- Rollback: drop table if exists public.job_checkpoints;
--           (e remover os tipos de job_checkpoints em src/types/database.ts)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.job_checkpoints (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings on delete cascade,
  job_id uuid references public.jobs on delete set null,
  user_id uuid not null references auth.users on delete cascade,
  step_name text not null,
  status text not null default 'running'
    check (status in ('pending', 'running', 'completed', 'failed')),
  payload jsonb check (payload is null or jsonb_typeof(payload) = 'object'),
  fingerprint text,
  attempts integer not null default 0 check (attempts >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, step_name)
);

create index if not exists idx_job_checkpoints_job_id
  on public.job_checkpoints(job_id);

create index if not exists idx_job_checkpoints_meeting_status
  on public.job_checkpoints(meeting_id, status);

-- RLS: tabela server-only, mesmo padrão de meeting_transcript_chunks /
-- meeting_chat_outbox (migration 013): sem policies, acesso só via service role.
alter table public.job_checkpoints enable row level security;

revoke all on table public.job_checkpoints from authenticated;
revoke all on table public.job_checkpoints from anon;
revoke all on table public.job_checkpoints from public;

grant all on table public.job_checkpoints to service_role;

notify pgrst, 'reload schema';
