# Notura API - Contrato para Mobile e Agentes Codex

Ultima atualizacao: 2026-09-25 (sincronizado com o codigo em `src/app/api` e `src/lib`)

Este documento descreve o contrato atual da API Next (`/api/*`) para consumo pelo app
mobile (Kotlin Multiplatform) e por agentes de IA. Quando este documento e o codigo
divergirem, o codigo e a fonte de verdade e este documento deve ser corrigido.

## 1) Base URL e autenticacao

- Base URL: `https://<seu-dominio>` (production) ou `http://localhost:3000` (dev).
- Rotas de produto usam `withAuth` / `withAuthRateLimit` (`src/lib/api/auth.ts`).
- **Mobile deve enviar `Authorization: Bearer <access_token>`**. O token e o
  `access_token` de uma sessao do Supabase Auth. `requireAuth` valida o token com
  `supabase.auth.getUser(token)`. Sem header, a rota cai no fluxo de cookies (web).
- Header `Authorization` presente mas malformado (esquema diferente de `Bearer`, token
  vazio ou partes extras) retorna `401` direto.

Erro padrao sem autenticacao (`401`):

```json
{ "error": "Não autenticado." }
```

### 1.1 Login, cadastro e sessao (Supabase Auth, fora da API Next)

A API Next **nao possui** endpoint de login/cadastro. O cliente fala direto com o
Supabase Auth (GoTrue), como o web faz em `src/app/(auth)/login` e `signup`:

| Acao | Web (`supabase-js`) | Mobile (`supabase-kt`, modulo `auth-kt`) |
|---|---|---|
| Login com e-mail/senha | `auth.signInWithPassword` | `auth.signInWith(Email) { email; password }` |
| Cadastro | `auth.signUp` (com `options.data.name`) | `auth.signUpWith(Email) { email; password; data }` |
| Google | `auth.signInWithOAuth({ provider: "google" })` | `signInWith(IDToken)` com ID token nativo, ou OAuth via browser |
| Renovar sessao | automatico | automatico (`autoRefresh`) |
| Logout | `auth.signOut` | `auth.signOut()` |

Depois do login, o mobile usa `session.accessToken` como Bearer em toda chamada a `/api/*`.
Em `401`, tentar um refresh da sessao uma vez; se persistir, deslogar.

`POST /api/auth/logout` limpa **cookies** da sessao web e nao e necessario no mobile:
use `signOut()` do Supabase Auth.

## 2) Contrato comum

### 2.1 Formato de erro

```json
{ "error": "mensagem" }
```

Algumas rotas retornam campos extras (`code`, `quotaLimit`, `errorCode`,
`supportWhatsappUrl`) — documentados por rota.

### 2.2 Ownership

Rotas por `:id` de recurso privado validam ownership (`requireOwnership`). Recurso
inexistente ou de outro usuario:

```json
{ "error": "Acesso negado." }
```

Status HTTP: `403`.

### 2.3 Rate limit

Rotas protegidas retornam `429` com payload fixo:

```json
{
  "error": "Muitas requisições. Tente novamente em instantes.",
  "code": "rate_limited"
}
```

Headers (enviados no `429` **e** nas respostas de sucesso das rotas limitadas):

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch em segundos)
- `Retry-After` (segundos)

O limite e por usuario autenticado, janela deslizante. Ver matriz na secao 6.

### 2.4 Tipos e formatos

- `meetingDate`: `YYYY-MM-DD`, nao pode ser data futura.
- `whatsappNumber`: numero BR valido, normalizado com DDI `55...`.
- Status de reuniao: `pending | processing | completed | failed`.
- Status de tarefa (kanban): `todo | in_progress | completed`.
- Prioridade de tarefa na API: `alta | media | baixa` (persistida como `alta | média | baixa`).
- Plano: `free | pro | team`.
- Status de chat RAG: `processing | completed | failed`.
- Datas/hora: ISO 8601 UTC (`2026-04-10T10:00:00.000Z`).

## 3) Fluxo recomendado (mobile) para criar reuniao

1. `POST /api/meetings/upload` para obter URL pre-assinada.
2. `PUT` do arquivo binario em `uploadUrl` (Cloudflare R2). Enviar o mesmo
   `Content-Type` informado no passo 1. **Nao** enviar o Bearer para o R2.
3. `POST /api/meetings/process` com `r2Key + uploadToken + meetingDate`.
4. Polling em `GET /api/meetings/{id}/status` ate `completed` ou `failed`.
5. Buscar detalhes em `GET /api/meetings/{id}`.
6. Se `failed`, oferecer `POST /api/meetings/{id}/retry`.

## 4) Endpoints de produto

### 4.1 Usuario

### `GET /api/user/me`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Nome",
    "company": "Empresa",
    "whatsappNumber": "5511999999999",
    "plan": "free",
    "effectivePlan": "free",
    "billingEntitlementStatus": "free",
    "isPaidPlanActive": false,
    "canSendWhatsAppSummary": false,
    "canProcessMeetings": true,
    "meetingQuotaBlockCode": null,
    "meetingQuotaLimit": 3,
    "meetingsThisMonth": 0,
    "monthlyLimit": 3,
    "currentPeriodEnd": null,
    "billingProvider": "stripe",
    "autoRenewEnabled": true,
    "renewalStatus": "idle",
    "abacatepayAutoRenewEnabled": true,
    "abacatepayRenewalStatus": "idle",
    "hasUsedTrial": false,
    "trialEndAt": null,
    "shouldOfferTrial": true
  }
}
```

- `company` e `whatsappNumber` sao `""` quando nao preenchidos.
- `billingEntitlementStatus`: `free | trialing | active | expired | grace`.
- `meetingQuotaBlockCode`: `lifetime_quota_exceeded | period_quota_exceeded | subscription_expired | null`.
- `monthlyLimit`: `number | null` (`null` = ilimitado).
- `billingProvider`: `stripe | abacatepay`.
- `abacatepayAutoRenewEnabled` / `abacatepayRenewalStatus` sao aliases legados de
  `autoRenewEnabled` / `renewalStatus`.

Erros: `401`, `500`.

### `PATCH /api/user/me`

Body parcial:

```json
{ "name": "Novo nome", "company": "Nova empresa", "whatsappNumber": "5511999999999" }
```

- `whatsappNumber` aceita `string` ou `null`. Strings vazias viram `null`.
- Retorno: mesmo contrato de `GET /api/user/me`.
- Erros: `400`, `401`, `500`.

### `DELETE /api/user/account`

Remove dados e o usuario do Supabase Auth. `200`: `{ "success": true }`. Erros: `401`, `500`.

### `POST /api/auth/logout`

Somente web (cookies). `204` sem body; `500` `{ "error": "Erro ao encerrar sessão." }`.

### 4.2 Dashboard

### `GET /api/dashboard/overview`

```json
{
  "userName": "Gabriel",
  "plan": "pro",
  "meetingsThisMonth": 4,
  "monthlyLimit": 30,
  "recentMeetings": [
    {
      "id": "meeting-1",
      "clientName": "Acme",
      "title": "Kickoff",
      "createdAt": "2026-04-10T10:00:00.000Z",
      "status": "completed",
      "groupName": null
    }
  ],
  "openTasks": [
    { "id": "task-1", "text": "Enviar proposta", "completed": false, "createdAt": "2026-04-10T10:10:00.000Z" }
  ],
  "openTaskCount": 1,
  "hoursSaved": 3,
  "todayCount": 1
}
```

- `monthlyLimit`, `clientName`, `title`, `groupName` podem ser `null`.

Erros: `401`, `500`.

### 4.3 Meetings

### `GET /api/meetings`

Query opcional: `limit` (padrao 20, max 100), `cursor`, `groupId`.

- Sem `limit` e sem `cursor`: retorna todas as reunioes, `{ "meetings": [...] }`.
- Com `limit` ou `cursor`: paginado por `created_at desc, id desc`:

```json
{
  "meetings": [
    {
      "id": "meeting-1",
      "title": "Kickoff",
      "clientName": "Acme",
      "groupId": null,
      "groupName": null,
      "createdAt": "2026-04-10T10:00:00.000Z",
      "status": "completed"
    }
  ],
  "nextCursor": "opaque-base64url",
  "hasMore": true
}
```

- `nextCursor` e opaco; `null` quando `hasMore` e `false`. Cursor invalido e ignorado.

Erros: `401`, `500`.

### `POST /api/meetings/upload`

Body:

```json
{ "fileName": "audio.m4a", "contentType": "audio/mp4", "fileSize": 1024 }
```

`200`:

```json
{
  "r2Key": "meetings/user-id/.../audio.m4a",
  "uploadUrl": "https://...",
  "uploadToken": "signed-token",
  "method": "PUT",
  "expiresInSeconds": 900
}
```

Erros:
- `400` corpo nao-JSON.
- `403` quota do plano esgotada (`{ "error": "<mensagem da quota>" }`).
- `413` arquivo > 500MB.
- `415` `contentType` nao comeca com `audio/` nem `video/`.
- `422` `fileName`, `fileSize` ou `contentType` ausente/invalido.
- `429` rate limit.
- `500` falha ao gerar URL.

### `POST /api/meetings/process`

Body:

```json
{
  "meetingDate": "2026-04-10",
  "r2Key": "meetings/user-id/.../audio.m4a",
  "uploadToken": "signed-token",
  "groupId": "uuid-opcional",
  "whatsappNumber": "(11) 98888-7777"
}
```

- Obrigatorios: `meetingDate`, `r2Key`, `uploadToken`.
- `groupId` opcional (`string | null`).
- `whatsappNumber` opcional; so e validado/usado quando o plano permite resumo por WhatsApp.
- `clientName` **nao** e aceito: a reuniao e criada com `client_name = null` e titulo
  `Reunião <meetingDate>`.

Novo registro `201`, ou upload ja registrado `200` (idempotente por `r2Key`):

```json
{ "meetingId": "meeting-1", "status": "pending" }
```

Erros:
- `400` corpo invalido.
- `403` token de upload invalido/expirado, upload de outro usuario, ou quota do plano.
- `409` arquivo nao encontrado no storage, sem tamanho, ou tamanho diferente do token.
- `413` arquivo > 500MB.
- `422` `meetingDate` ausente/futura, `r2Key`/`uploadToken` ausente, `groupId` invalido, `whatsappNumber` invalido.
- `429` rate limit.
- `500` erro de banco/quota.
- `503` fila indisponivel (reuniao marcada como `failed`, pode usar retry).

### `GET /api/meetings/{id}`

Retorna a linha completa de `meetings` + relacoes, em **snake_case** (linha do banco).
Relacoes ordenadas por `created_at asc`.

```json
{
  "id": "meeting-1",
  "user_id": "user-1",
  "group_id": null,
  "title": "Reunião 2026-04-10",
  "client_name": null,
  "meeting_date": "2026-04-10",
  "audio_r2_key": "meetings/...",
  "transcript": "...",
  "summary_whatsapp": "...",
  "summary_json": {},
  "summary_structured": {},
  "summary_version": 1,
  "whatsapp_number": "",
  "whatsapp_status": "pending",
  "status": "completed",
  "source": "upload",
  "duration_seconds": 1800,
  "cost_usd": 0.12,
  "assemblyai_transcript_id": "...",
  "prompt_version": "...",
  "error_message": null,
  "created_at": "2026-04-10T10:00:00.000Z",
  "completed_at": "2026-04-10T10:03:00.000Z",
  "tasks": [
    {
      "id": "task-1", "meeting_id": "meeting-1", "user_id": "user-1", "dedupe_key": "...",
      "description": "Enviar proposta", "owner": "Ana", "due_date": "2026-04-12",
      "priority": "média", "status": "todo", "completed": false, "completed_at": null,
      "created_at": "...", "source": "ai_extracted", "group_id": null
    }
  ],
  "decisions": [
    {
      "id": "decision-1", "meeting_id": "meeting-1", "user_id": "user-1", "dedupe_key": "...",
      "description": "Aprovar orcamento", "decided_by": "Ana", "confidence": "alta", "created_at": "..."
    }
  ],
  "open_items": [
    {
      "id": "item-1", "meeting_id": "meeting-1", "user_id": "user-1", "dedupe_key": "...",
      "description": "Definir fornecedor", "context": null, "created_at": "..."
    }
  ],
  "meeting_participants": [
    {
      "id": "p-1", "meeting_id": "meeting-1", "display_name": "Ana", "original_name": "Speaker A",
      "role": "participant", "created_at": "...", "updated_at": "..."
    }
  ]
}
```

- `whatsapp_status`: `pending | sent | failed`. `source`: `upload | zoom_webhook | chrome_extension`.
- Tarefas aqui usam prioridade do banco (`alta | média | baixa`).
- `confidence` de decisao: `alta | média`. `role` de participante: `participant | entity`.
- `summary_json` (`MeetingJSON` em `src/types/database.ts`): `meeting` (title, date_mentioned,
  duration_minutes, participants, participant_count), `decisions`, `tasks`, `open_items`,
  `next_meeting` (datetime, location_or_link), `summary_one_line`, `metadata`. Pode ser `null`.
- `summary_structured` (`MeetingStructuredSummary`): `version`, `title`,
  `sections[] { title, content, participant_ids[] }`,
  `action_items[] { description, participant_id, due_date, priority }`. Pode ser `null`.

Erros: `401`, `403`, `500`.

### `PATCH /api/meetings/{id}`

Body parcial (ao menos 1 campo):

```json
{ "title": "Novo titulo", "meetingDate": "2026-04-10" }
```

`200`:

```json
{ "id": "meeting-1", "title": "Novo titulo", "meetingDate": "2026-04-10", "groupId": null }
```

Erros: `400` (JSON invalido ou validacao), `401`, `403`, `500`.

### `DELETE /api/meetings/{id}`

`200` `{ "success": true }`. Idempotente. Erros: `401`, `403`, `500`.

### `GET /api/meetings/{id}/status`

```json
{
  "id": "meeting-1",
  "title": "Reunião 2026-04-10",
  "status": "processing",
  "processingStep": "transcribe",
  "jobStatus": "processing",
  "errorMessage": null,
  "taskCount": 2,
  "decisionCount": 1
}
```

- `processingStep`: nome do passo atual do job (informativo; pode ser `null`).
- `jobStatus`: `queued | processing | completed | failed | null`.

Erros: `401`, `403`, `404`, `500`.

### `POST /api/meetings/{id}/retry`

Reenfileira processamento (somente `status=failed`). `200`:

```json
{ "success": true, "meetingId": "meeting-1" }
```

Erros: `400`, `401`, `403` (ownership ou plano exigido para WhatsApp), `409` (nao esta `failed`),
`422` (sem audio), `429`, `500`.

### `POST /api/meetings/{id}/cancel-processing`

Somente para `status=processing`. `200`:

```json
{ "success": true, "meetingId": "meeting-1", "status": "failed" }
```

Erros: `400`, `401`, `403`, `409`, `500`.

### `POST /api/meetings/{id}/resend`

Reenvia resumo no WhatsApp (max 3 reenvios por reuniao). `200`:

```json
{ "success": true, "whatsapp_status": "sent", "resends_remaining": 2 }
```

Erros: `400` (sem resumo ou sem numero), `401`, `403` (ownership ou plano), `429`
(rate limit **ou** limite de 3 reenvios — este sem `code`), `502` (falha no WhatsApp), `500`.

### `POST /api/meetings/{id}/export`

Gera a ata em `.docx`. Body opcional: `{ "templateId": "default" | "<uuid>" }`. `200`:

```json
{ "url": "https://...", "filename": "Ata - ....docx", "expiresIn": 3600 }
```

Erros: `401`, `403` (ownership, plano pago exigido ou modelo customizado exige Pro), `404`
(modelo nao encontrado), `422` (modelo invalido), `429`, `500`.

### `PATCH /api/meetings/{id}/group`

Body: `{ "groupId": "uuid" | null }`. `200`: `{ "meetingId": "meeting-1", "groupId": "uuid" }`.
Erros: `400`, `401`, `403`, `500`.

### `GET /api/meetings/{id}/participants`

`200`: `{ "participants": [ { "id", "displayName", "originalName", "role" } ] }`.

### `PATCH /api/meetings/{id}/participants`

Body: `{ "participantId", "displayName"?, "role"?, "mergeIntoParticipantId"? }`.
`200`: `{ "participant": { "id", "displayName", "originalName", "role" } }`.
Erros: `400`, `401`, `403`, `429`, `500`.

### `PATCH /api/meetings/{id}/participants/{participantId}`

Body: `{ "displayName"?, "role"? }`. Mesmo retorno/erros acima.

### 4.4 Chat RAG por reuniao

Detalhes de UX e fallbacks: `docs/meeting-rag-chat-frontend.md`.
Cada pergunta cria um chat novo (uma pergunta, uma resposta). Nao ha mensagens
subsequentes no mesmo chat.

Objeto `MeetingChat`:

```json
{
  "id": "uuid",
  "status": "completed",
  "question": "Quais prazos foram combinados?",
  "answer": "O prazo combinado foi sexta-feira.",
  "fallbackReason": null,
  "modelConfirmed": true,
  "sources": [
    { "chunkId": "uuid", "similarity": 0.82, "startMs": 12000, "endMs": 48000, "speaker": "A", "text": "..." }
  ],
  "errorMessage": null,
  "createdAt": "2026-04-30T12:00:00.000Z",
  "completedAt": "2026-04-30T12:00:03.000Z"
}
```

- `fallbackReason`: `no_transcript | meeting_not_ready | low_similarity | not_confirmed_by_model | provider_error | null`.

### `GET /api/meetings/{id}/chats`

Historico: array de `MeetingChat` com `status` `completed` ou `failed`, mais recente primeiro.
Erros: `401`, `403`, `500`.

### `POST /api/meetings/{id}/chats`

Body: `{ "question": "..." }` (max 500 caracteres e 3 frases apos normalizar espacos).

`202`: `{ "chatId": "uuid", "status": "processing" }`

Erros:
- `400` `{ "error": "question_too_long" }` (vazia, longa ou > 3 frases) ou `{ "error": "Body JSON inválido." }`.
- `403` `{ "error": "ai_chat_daily_quota_exceeded", "quotaLimit": 10 }` ou `{ "error": "Acesso negado." }`.
- `409` `{ "error": "meeting_not_ready" }`.
- `422` `{ "error": "no_transcript" }`.
- `429` rate limit (2 req / 60s).
- `500`.

### `GET /api/meetings/{id}/chats/{chatId}`

`200`: `MeetingChat`. Fazer polling ate `completed`/`failed`. Erros: `401`, `403`, `404`, `500`.

### `DELETE /api/meeting-chats/{chatId}`

`200` `{ "success": true }`. Erros: `401`, `403`, `500`.

### 4.5 Grupos de reuniao

### `GET /api/meeting-groups`

Query opcional `include_archived=1`. `200`:

```json
{
  "groups": [
    { "id": "uuid", "name": "Cliente X", "created_at": "...", "updated_at": "...", "archived_at": null, "meetings_count": 3 }
  ],
  "meetings": [
    { "id": "meeting-1", "title": "...", "client_name": null, "status": "completed", "created_at": "...", "group_id": "uuid" }
  ]
}
```

### `POST /api/meeting-groups`

Body `{ "name": "Cliente X" }` (1–80 caracteres). `201` `{ "group": { ... } }`. Erros: `400`, `401`, `429`, `500`.

### `PATCH /api/meeting-groups/{id}`

Body `{ "name"?: string, "archived"?: boolean }`. `200` `{ "group": { ... } }`. Erros: `400`, `401`, `403`, `429`, `500`.

### `DELETE /api/meeting-groups/{id}`

`200` `{ "success": true }`. Erros: `401`, `403`, `429`, `500`.

### 4.6 Modelos de ata

### `GET /api/meeting-templates`

`200`: `{ "templates": [ { "id": "default", "name": "...", "isDefault": true, "editable": false, "createdAt"? } ] }`.
Sem plano Pro retorna apenas o modelo padrao.

### `POST /api/meeting-templates`

`multipart/form-data` com `file` (`.docx`, max 5MB) e `name`. `201` `{ "template": { ... } }`.
Erros: `400`, `401`, `403` (exige Pro), `413`, `422`, `429`, `500`.

### `DELETE /api/meeting-templates/{id}`

`204` sem body. Erros: `401`, `403`, `404`, `429`, `500`.

### 4.7 Tasks

### `GET /api/tasks`

Query opcional: `meetingId`, `groupId`. `200`:

```json
{
  "columns": [
    {
      "id": "todo",
      "title": "A Fazer",
      "dotColor": "#6C5CE7",
      "badgeColor": "#A29BFE",
      "badgeBg": "rgba(108,92,231,0.15)",
      "tasks": [
        {
          "id": "task-1",
          "title": "Enviar proposta",
          "priority": "media",
          "columnId": "todo",
          "meetingId": "meeting-1",
          "groupId": "uuid",
          "source": "ai_extracted",
          "dueDate": "2026-04-12",
          "completedDate": "Concluído em 12 de abr.",
          "assignee": { "name": "Gabriel" },
          "assignees": [{ "name": "Gabriel" }],
          "meetingSource": "Acme",
          "generatedByAI": true,
          "labels": [{ "id": "uuid", "name": "Urgente", "color": "#FF0000" }]
        }
      ]
    }
  ],
  "meetings": [
    { "id": "meeting-1", "title": "Kickoff", "clientName": "Acme", "label": "Acme - Kickoff" }
  ]
}
```

- Colunas sempre na ordem `todo`, `in_progress` ("Em Andamento"), `completed` ("Concluído").
- Campos opcionais da task sao **omitidos** quando vazios: `groupId`, `dueDate`,
  `completedDate`, `assignee`, `assignees`, `meetingSource`.
- `source`: `ai_extracted | manual`.

Erros: `401`, `500`.

### `POST /api/tasks`

Body minimo: `{ "meeting_id": "meeting-1", "description": "Enviar proposta" }`.

Opcionais: `priority` (`alta | media | baixa`), `owner` (`string | null`), `due_date`
(`YYYY-MM-DD | null`), `status` (`todo | in_progress | completed`), `group_id`, `label_ids` (`string[]`).

`201`: `{ "task": <task do board> }`. Erros: `400`, `401`, `403`, `500`.

### `PATCH /api/tasks/{id}`

Body parcial: `description`, `priority`, `owner`, `due_date`, `group_id`, `status`
(ou `kanban_status`, ou `completed: boolean` como fallback), `label_ids`.

`200`: `{ "task": <task do board> }`. Erros: `400`, `401`, `403`, `500`.

### `DELETE /api/tasks/{id}`

`200` `{ "success": true }`. Erros: `400`, `401`, `403`, `500`.

### `GET /api/task-labels` / `POST /api/task-labels` / `DELETE /api/task-labels/{id}`

- GET `200`: `{ "labels": [ { "id", "name", "color", ... } ] }`.
- POST body `{ "name", "color"? }` (cor padrao `#6C5CE7`) → `201` `{ "label": { "id", "name", "color", "created_at" } }`; `400`; `409` nome duplicado.
- DELETE `200` `{ "success": true }`.

### 4.8 Billing

Fachada atual: `/api/billing/*` (Stripe como principal, AbacatePay como fallback
automatico). As rotas `/api/stripe/*` e `/api/abacatepay/*` sao legadas e **nao devem**
ser usadas por clientes novos.

### `POST /api/billing/checkout`

Body: `{ "plan": "pro" | "team", "billingCycle"?: "monthly" | "yearly", "source"?: "onboarding" | "settings" }`.

`200`:

```json
{ "provider": "stripe", "checkoutUrl": "https://checkout.stripe.com/..." }
```

ou `{ "provider": "stripe", "alreadyActive": true, "plan": "pro" }`.

Erros: `400` plano invalido, `401`, `429`, `500`, e status do gateway com
`{ "error", "errorCode"?: "payment_received_plan_pending", "supportWhatsappUrl"? }`.

### `POST /api/billing/checkout/verify`

Body opcional `{ "sessionId": "cs_..." }` (Stripe; sem ele verifica AbacatePay).
`200`: `{ "provider", "success": true, "plan", "paymentStatus"? }`. Erros: `401`, `429`, status do gateway, `500`.

### `POST /api/billing/trial/checkout`

Sem body. `200`: mesmo formato de `/api/billing/checkout`. Erros: `401`, `429`, status do gateway, `500`.

### `POST /api/billing/trial/verify`

Body `{ "sessionId": "cs_..." }` (obrigatorio). `200`: mesmo formato de `checkout/verify`.
Erros: `400`, `401`, `429`, status do gateway, `500`.

### `PATCH /api/billing/trial/dismiss`

`200` `{ "dismissed": true }`. Erros: `401`, `429`, `500`.

### `PATCH /api/billing/auto-renew`

Body `{ "enabled": boolean }`. `200`: `{ "provider", "autoRenewEnabled", "currentPeriodEnd", "renewalStatus" }`.
Erros: `400`, `401`, `500`.

### `POST /api/billing/customer/ensure`

Body opcional `{ "source" }`. `200` `{ "success": true, "provider", "customerId" }`;
`202` `{ "success": false, "provider", "inProgress": true }` quando em andamento. Erros: `401`, `500`.

### 4.9 Outros

### `POST /api/assemblyai/token`

`200` `{ "token": "jwt-temporario" }`. Erros: `401`, `429`, `500`, `502`.

### `GET /api/integration-interest` / `POST /api/integration-interest`

Canais: `zoom | chrome_extension | google_calendar`.
GET `200` `{ "channels": [...] }`; POST body `{ "channel" }` → `200` `{ "channel" }`; `400` canal invalido.

## 5) Endpoints de integracao/internos (nao chamar do mobile)

- `POST /api/webhooks/abacatepay`, `POST /api/webhooks/assemblyai`, `POST /api/webhooks/stripe`
- `GET /api/internal/health`
- `GET|POST|PUT /api/inngest`
- `GET /api/sentry-example-api`
- `/api/stripe/*` e `/api/abacatepay/*` (legado, ver 4.8)
- `POST /api/auth/logout` (somente web)

## 6) Matriz de rate-limit por rota

Fonte: `src/lib/api/rate-limit-policies.ts`.

| Rota | Limite |
|---|---|
| `POST /api/meetings/upload` | 20 / 60s |
| `POST /api/meetings/process` | 10 / 60s |
| `POST /api/meetings/{id}/chats` | 2 / 60s |
| `POST /api/meetings/{id}/retry` | 5 / 60s |
| `POST /api/meetings/{id}/resend` | 5 / 60s |
| `POST /api/meetings/{id}/export` | 20 / 60s |
| `GET /api/meetings/{id}/participants` | 60 / 60s |
| `PATCH /api/meetings/{id}/participants[/{participantId}]` | 30 / 60s |
| `POST /api/meeting-groups` | 20 / 60s |
| `PATCH|DELETE /api/meeting-groups/{id}` | 30 / 60s |
| `GET /api/meeting-templates` | 60 / 60s |
| `POST /api/meeting-templates` | 10 / 60s |
| `DELETE /api/meeting-templates/{id}` | 30 / 60s |
| `POST /api/assemblyai/token` | 30 / 60s |
| `POST /api/billing/checkout` | 10 / 300s |
| `POST /api/billing/checkout/verify` | 30 / 60s |
| `POST /api/billing/trial/checkout` | 10 / 300s |
| `POST /api/billing/trial/verify` | 30 / 60s |
| `PATCH /api/billing/trial/dismiss` | 30 / 60s |
| `POST /api/stripe/checkout` (legado) | 10 / 300s |
| `POST /api/stripe/checkout/verify` (legado) | 30 / 60s |
| `POST /api/abacatepay/checkout` (legado) | 10 / 300s |
| `POST /api/abacatepay/checkout/verify` (legado) | 30 / 60s |
| `POST /api/webhooks/*` | 30 / 60s |
| `GET /api/internal/health` | 240 / 60s |

Outras cotas (nao sao rate limit HTTP):
- Chat RAG: 10 chats/dia por usuario (`403 ai_chat_daily_quota_exceeded`).
- Reenvio de WhatsApp: 3 por reuniao (`429` sem `code`).
- Reunioes por periodo: conforme plano (`403` em upload/process).

## 7) Checklist operacional

- Enviar `Authorization: Bearer <access_token>` em toda chamada `/api/*` do mobile.
- `401`: tentar refresh da sessao Supabase uma vez; se persistir, deslogar.
- `403`: ownership, plano ou cota — ler `error` (e `code`/`quotaLimit` quando houver).
- `429` com `code: "rate_limited"`: esperar `Retry-After` segundos antes de tentar de novo.
- Aplicar os limites da secao 6 tambem na UI (desabilitar acao ate liberar).
- No fluxo de reuniao, **nunca** pular `upload -> PUT -> process`.
- Polling de processamento em `GET /api/meetings/{id}/status`; payload completo em `GET /api/meetings/{id}`.
