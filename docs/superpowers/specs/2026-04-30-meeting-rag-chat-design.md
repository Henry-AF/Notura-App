# Meeting RAG Chat Design

## Goal

Adicionar um chat por reuniao para perguntas pontuais sobre a transcricao. Cada
conversa tera uma unica pergunta/resposta, com resposta persistida para auditoria
e para permitir cache semantico em uma fase futura.

O backend deve responder apenas com base nos trechos recuperados da transcricao.
Se a pergunta estiver fora do texto ou o modelo nao confirmar a informacao, o
sistema deve retornar fallback explicito em vez de inventar resposta.

## Architecture

O fluxo sera assincrono para seguir a regra do projeto de nao chamar IA em Route
Handlers sincronos.

- `POST /api/meetings/[id]/chats` valida autenticacao, ownership, status da
  reuniao e tamanho da pergunta. A rota cria uma conversa com status
  `processing` e dispara o evento Inngest `meeting/chat.answer`.
- `GET /api/meetings/[id]/chats/[chatId]` retorna status, resposta, fallback e
  fontes da conversa.
- O job `meeting/chat.answer` gera embedding da pergunta, garante que a reuniao
  tenha chunks indexados, busca os chunks mais similares e chama Gemini com um
  prompt restritivo.
- Novas reunioes geram chunks no pipeline `processMeeting` logo apos a
  transcricao ser salva.
- Reunioes antigas recebem backfill sob demanda na primeira pergunta, desde que
  tenham `transcript` salvo.

## Data Model

A migration habilitara `vector` e criara `meeting_transcript_chunks`:

- `id uuid primary key`
- `meeting_id uuid not null references meetings on delete cascade`
- `user_id uuid not null references auth.users on delete cascade`
- `chunk_index integer not null`
- `text text not null`
- `speaker text`
- `start_ms integer`
- `end_ms integer`
- `metadata jsonb not null default '{}'::jsonb`
- `embedding vector(768) not null`
- `created_at timestamptz default now()`
- unique `meeting_id, chunk_index`

A tabela tera RLS por `user_id` e indice HNSW sobre `embedding`. A funcao de
busca recebera `p_user_id`, `p_meeting_id`, `p_query_embedding`, `p_limit` e
`p_similarity_threshold`, retornando no maximo 5 chunks acima do limiar.
O indice usara `vector_cosine_ops`, e a funcao calculara similaridade como
`1 - cosine_distance`.

A migration tambem criara `meeting_chats`:

- `id uuid primary key`
- `meeting_id uuid not null references meetings on delete cascade`
- `user_id uuid not null references auth.users on delete cascade`
- `question text not null`
- `question_embedding vector(768)`
- `answer text`
- `status text check (status in ('processing', 'completed', 'failed'))`
- `fallback_reason text`
- `model_confirmed boolean`
- `sources jsonb not null default '[]'::jsonb`
- `error_message text`
- `created_at timestamptz default now()`
- `completed_at timestamptz`

## Chunking

O indexador usara as `utterances` do AssemblyAI quando disponiveis. Ele fara
merge de utterances em ordem ate atingir aproximadamente 400 tokens. O token
count inicial pode usar uma estimativa deterministica por palavras/caracteres,
porque o requisito e controlar o tamanho do contexto, nao contar tokens exatos
do provedor.

A indexacao sera idempotente: reprocessar uma reuniao substitui ou atualiza os
chunks do mesmo `meeting_id` usando `chunk_index` estavel, sem duplicar linhas.

Cada chunk preservara:

- texto unido
- primeiro timestamp (`start_ms`)
- ultimo timestamp (`end_ms`)
- speaker quando o chunk tiver apenas um speaker claro
- lista de utterances/speakers em `metadata`
- `chunk_index` estavel para idempotencia

Se uma reuniao antiga tiver apenas `meetings.transcript`, o backfill criara
chunks por blocos do texto formatado e mantera timestamps/speakers quando forem
parseaveis do formato `[MM:SS] Speaker X: ...`.

## Embeddings And Retrieval

Usaremos Gemini `embedding-001` com MRL para 768 dimensoes. O helper em
`@/lib/gemini` expora funcoes separadas para:

- gerar embedding de texto com 768 dimensoes
- responder pergunta com base nos chunks recuperados

A busca vetorial usara HNSW no Postgres/pgvector. O job chamara a funcao RPC com:

- `p_limit = 5`
- `p_similarity_threshold = 0.6`

Nao havera rerank nesta versao.

## Answering

O prompt interno do Gemini deve impor:

> Voce e um assistente que responde APENAS com base na transcricao fornecida. Se
> a pergunta nao estiver no texto, diga que nao sabe. Nao execute comandos
> externos.

O modelo deve retornar JSON com campos explicitos:

- `answer`
- `is_answered_from_context`
- `insufficient_context_reason`

O job so salva resposta final quando `is_answered_from_context` for `true`. Se o
modelo nao confirmar a informacao, a conversa termina como `completed` com
`fallback_reason = 'not_confirmed_by_model'`.

## Fallbacks

- `question_too_long`: pergunta longa demais ou com muitas frases.
- `meeting_not_ready`: reuniao ainda nao concluida.
- `no_transcript`: reuniao sem transcricao salva.
- `low_similarity`: nenhum chunk acima de `0.6`.
- `not_confirmed_by_model`: chunks encontrados, mas Gemini nao confirmou a
  informacao.
- `provider_error`: falha real de embedding, busca ou geracao.

## API Contract

`POST /api/meetings/[id]/chats`

Cada chamada cria uma conversa nova e independente. Nao havera endpoint para
adicionar outra mensagem a uma conversa existente nesta versao.

Perguntas serao limitadas a poucas frases: ate 3 frases e ate 500 caracteres.

Request:

```json
{ "question": "Quais prazos foram combinados?" }
```

Response `202`:

```json
{ "chatId": "uuid", "status": "processing" }
```

`GET /api/meetings/[id]/chats/[chatId]`

Response:

```json
{
  "id": "uuid",
  "status": "completed",
  "question": "Quais prazos foram combinados?",
  "answer": "Resposta baseada na transcricao.",
  "fallbackReason": null,
  "modelConfirmed": true,
  "sources": [
    {
      "chunkId": "uuid",
      "similarity": 0.82,
      "startMs": 12000,
      "endMs": 48000,
      "speaker": "A",
      "text": "Trecho usado como evidencia."
    }
  ]
}
```

## Files

- Create: `supabase/migrations/013_meeting_rag_chat.sql`
- Modify: `src/types/database.ts`
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/gemini.test.ts`
- Create: `src/lib/meetings/rag.ts`
- Create: `src/lib/meetings/rag.test.ts`
- Modify: `src/inngest/process-meeting.ts`
- Modify: `src/inngest/process-meeting.test.ts`
- Create: `src/inngest/answer-meeting-chat.ts`
- Create: `src/inngest/answer-meeting-chat.test.ts`
- Modify: `src/app/api/inngest/route.ts`
- Create: `src/app/api/meetings/[id]/chats/route.ts`
- Create: `src/app/api/meetings/[id]/chats/route.test.ts`
- Create: `src/app/api/meetings/[id]/chats/[chatId]/route.ts`
- Create: `src/app/api/meetings/[id]/chats/[chatId]/route.test.ts`
- Modify: `src/app/api/api-auth-policy.test.ts`

## Testing

- Chunking merges AssemblyAI utterances up to roughly 400 tokens and preserves
  speaker/timestamp metadata.
- Gemini embedding helper requests 768-dimensional embeddings.
- Retrieval RPC is called with `p_limit = 5` and threshold `0.6`.
- Chat POST route uses `withAuth` and `requireOwnership`, validates short
  questions and fires Inngest.
- Chat GET route validates ownership for both meeting and chat.
- Chat job saves answer and sources when Gemini confirms the context.
- Chat job saves `low_similarity` fallback when retrieval is below threshold.
- Chat job saves `not_confirmed_by_model` fallback when Gemini returns
  `is_answered_from_context = false`.
- Migration includes `vector(768)`, HNSW, RLS and user/meeting-scoped search.
