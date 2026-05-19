# Meeting RAG Chat Frontend Guide

Este guia mostra como consumir o backend de chat RAG por reuniao no frontend.
A feature atual e backend-only: cada pergunta cria um chat novo, com uma unica
mensagem do usuario e uma unica resposta persistida.

## Fluxo Recomendado

1. Na tela de detalhe da reuniao, mostre um botao de chat/pergunta somente quando
   a reuniao estiver `completed`.
2. Ao enviar uma pergunta curta, chame `POST /api/meetings/[id]/chats`.
3. A API retorna `202` com `chatId` e `status: "processing"`.
4. Inicie polling em `GET /api/meetings/[id]/chats/[chatId]`.
5. Pare o polling quando `status` for `completed` ou `failed`.
6. Para outra pergunta, crie outro chat com outro `POST`.

Nao existe endpoint para adicionar uma segunda mensagem ao mesmo chat.

## Criar Chat

`POST /api/meetings/[id]/chats`

Request:

```json
{
  "question": "Quais prazos foram combinados?"
}
```

Success `202`:

```json
{
  "chatId": "uuid",
  "status": "processing"
}
```

Erros esperados:

- `400 { "error": "question_too_long" }`: pergunta vazia, longa demais ou com
  mais de 3 frases.
- `400 { "error": "Body JSON invalido." }`: corpo invalido.
- `403 { "error": "ai_chat_daily_quota_exceeded", "quotaLimit": 10 }`: limite
  diario de chats com IA atingido para o usuario.
- `403 { "error": "Acesso negado." }`: reuniao fora do usuario autenticado.
- `409 { "error": "meeting_not_ready" }`: reuniao ainda nao concluida.
- `422 { "error": "no_transcript" }`: reuniao sem transcricao salva.
- `429 { "error": "Muitas requisições. Tente novamente em instantes.", "code": "rate_limited" }`:
  limite de criacao de chats no curto prazo atingido. Respeite o header
  `Retry-After`.
- `500 { "error": "Erro ao criar chat da reuniao." }`: falha inesperada.

## Ler Chat

`GET /api/meetings/[id]/chats/[chatId]`

Response:

```json
{
  "id": "uuid",
  "status": "completed",
  "question": "Quais prazos foram combinados?",
  "answer": "O prazo combinado foi sexta-feira.",
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
  ],
  "errorMessage": null,
  "createdAt": "2026-04-30T12:00:00.000Z",
  "completedAt": "2026-04-30T12:00:03.000Z"
}
```

`status` pode ser:

- `processing`: o job Inngest ainda esta respondendo.
- `completed`: resposta ou fallback final disponivel.
- `failed`: falha tecnica; use `errorMessage` para suporte/log.

## Fallbacks

Quando `status` for `completed`, nem sempre existe uma resposta confirmada. Use
`modelConfirmed` e `fallbackReason`:

- `modelConfirmed: true`: renderize `answer` normalmente.
- `modelConfirmed: false`: renderize uma mensagem de fallback.

Fallbacks conhecidos:

- `no_transcript`: a reuniao nao tem transcricao salva.
- `meeting_not_ready`: a reuniao nao estava concluida quando o job rodou.
- `low_similarity`: nenhum trecho passou o limiar de similaridade.
- `not_confirmed_by_model`: os trechos foram encontrados, mas o modelo nao
  confirmou a informacao.
- `provider_error`: falha tecnica em embedding, busca ou geracao.

Copy sugerida:

```ts
export function formatMeetingChatFallback(reason: string | null): string {
  if (reason === "low_similarity") {
    return "Nao encontrei essa informacao na transcricao desta reuniao.";
  }

  if (reason === "not_confirmed_by_model") {
    return "Encontrei trechos relacionados, mas eles nao confirmam a resposta com seguranca.";
  }

  if (reason === "meeting_not_ready") {
    return "A reuniao ainda esta sendo processada. Tente novamente em instantes.";
  }

  if (reason === "no_transcript") {
    return "Esta reuniao nao possui transcricao disponivel para consulta.";
  }

  return "Nao foi possivel responder esta pergunta agora.";
}
```

## Tipos Sugeridos

```ts
export interface CreateMeetingChatResponse {
  chatId: string;
  status: "processing";
}

export interface MeetingChatSource {
  chunkId: string;
  similarity: number;
  startMs: number | null;
  endMs: number | null;
  speaker: string | null;
  text: string;
}

export interface MeetingChatResponse {
  id: string;
  status: "processing" | "completed" | "failed";
  question: string;
  answer: string | null;
  fallbackReason: string | null;
  modelConfirmed: boolean | null;
  sources: MeetingChatSource[];
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}
```

## Helper De API

Para manter o padrao do projeto, coloque esse codigo no companion helper da
pagina, nao diretamente no componente.

```ts
import { normalizeError, parseJson } from "@/lib/api-client";

export async function createMeetingChat(
  meetingId: string,
  question: string
): Promise<CreateMeetingChatResponse> {
  const response = await fetch(`/api/meetings/${meetingId}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const body = await parseJson<CreateMeetingChatResponse & { error?: string }>(
    response
  );

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao criar chat."));
  }

  return body;
}

export async function fetchMeetingChat(
  meetingId: string,
  chatId: string
): Promise<MeetingChatResponse> {
  const response = await fetch(`/api/meetings/${meetingId}/chats/${chatId}`);
  const body = await parseJson<MeetingChatResponse & { error?: string }>(
    response
  );

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Erro ao carregar chat."));
  }

  return body;
}
```

## Polling

Use polling curto enquanto o chat estiver `processing`. Evite loops infinitos:
defina timeout ou numero maximo de tentativas.

```ts
export async function waitForMeetingChat(
  meetingId: string,
  chatId: string,
  options: { intervalMs?: number; maxAttempts?: number } = {}
): Promise<MeetingChatResponse> {
  const intervalMs = options.intervalMs ?? 1500;
  const maxAttempts = options.maxAttempts ?? 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const chat = await fetchMeetingChat(meetingId, chatId);
    if (chat.status !== "processing") return chat;

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Tempo limite ao aguardar resposta do chat.");
}
```

## Renderizacao

Com `completed` e `modelConfirmed: true`:

- Mostre `answer`.
- Opcionalmente mostre fontes recolhidas em detalhes/accordion.
- Para timestamps, converta `startMs`/`endMs` para `mm:ss`.

Com `completed` e `modelConfirmed: false`:

- Mostre copy de fallback por `fallbackReason`.
- Se `sources` vier preenchido em `not_confirmed_by_model`, voce pode mostrar
  "trechos relacionados", mas nao trate isso como resposta confirmada.

Com `failed`:

- Mostre erro generico ao usuario.
- Envie `errorMessage`, `meetingId` e `chatId` para observabilidade/suporte.

## Regras De UX

- Limite a UI a poucas frases, igual ao backend: ate 3 frases e 500 caracteres.
- Desabilite o input enquanto o chat atual estiver `processing`.
- Ao receber `429`, mantenha o input desabilitado ate `Retry-After` ou mostre
  uma mensagem curta para tentar novamente em instantes.
- Ao receber `ai_chat_daily_quota_exceeded`, mostre a mensagem de limite diario
  e nao reenvie automaticamente.
- Para nova pergunta, crie novo chat; nao reutilize o `chatId` anterior.
- Nao mostre o texto inteiro da transcricao como contexto; use apenas `sources`.
- Trate `sources` como evidencia auxiliar, nao como contrato de resposta.
