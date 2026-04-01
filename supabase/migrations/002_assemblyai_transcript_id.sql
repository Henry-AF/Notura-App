-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Add assemblyai_transcript_id to meetings
-- Needed to correlate AssemblyAI webhook callbacks back to the meeting row.
-- ─────────────────────────────────────────────────────────────────────────────

alter table meetings
  add column if not exists assemblyai_transcript_id text;

create index if not exists idx_meetings_assemblyai_transcript_id
  on meetings(assemblyai_transcript_id)
  where assemblyai_transcript_id is not null;
