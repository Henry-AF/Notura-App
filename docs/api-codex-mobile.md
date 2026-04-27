# Notura API - Guia para Agentes Codex (Mobile)

Ultima atualizacao: 2026-04-22

Este documento descreve o contrato atual da API Next (`/api/*`) para consumo por app mobile e por agentes de IA (Codex).

## 1) Base URL e autenticacao

- Base URL: `https://<seu-dominio>` (production) ou `http://localhost:3000` (dev).
- A maioria das rotas de produto usa `withAuth` e exige sessao valida.
- **Implementacao atual de auth**: as rotas autenticadas usam Supabase SSR via cookies (`createServerSupabase` + `auth.getUser()`), nao via `Authorization: Bearer`.
- Erro padrao sem autenticacao:

```json
{ "error": "Nao autenticado." }
```

Status HTTP: `401`.

## 2) Contrato comum

### 2.1 Formato de erro

Na maioria das rotas:

```json
{ "error": "mensagem" }
```

### 2.2 Ownership

Rotas por `:id` de recurso privado validam ownership. Quando falha:

```json
{ "error": "Acesso negado." }
```

Status HTTP: `403`.

### 2.3 Rate limit

Rotas protegidas por rate-limit retornam `429` com payload fixo:

```json
{
  "error": "Muitas requisicoes. Tente novamente em instantes.",
  "code": "rate_limited"
}
```

Headers de rate-limit:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

### 2.4 Tipos e formatos importantes

- `meetingDate`: formato `YYYY-MM-DD` e nao pode ser data futura.
- `whatsappNumber`: numero BR valido, normalizado para formato com DDI `55...`.
- Status de reuniao: `pending | processing | completed | failed`.
- Status de tarefa (kanban): `todo | in_progress | completed`.

## 3) Fluxo recomendado (mobile) para criar reuniao

1. `POST /api/meetings/upload` para iniciar upload direto.
2. Fazer `PUT` do arquivo binario no `uploadUrl` retornado (Cloudflare R2).
3. `POST /api/meetings/process` com `r2Key + uploadToken + metadados`.
4. Polling em `GET /api/meetings/{id}/status` ate `completed` ou `failed`.
5. Buscar detalhes em `GET /api/meetings/{id}`.
6. Se `failed`, oferecer `POST /api/meetings/{id}/retry`.

## 4) Endpoints de produto (para app mobile)

### 4.1 Usuario

### `GET /api/user/me`

Retorna perfil e dados de plano:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Nome",
    "company": "Empresa",
    "whatsappNumber": "5511999999999",
    "plan": "free",
    "meetingsThisMonth": 0,
    "monthlyLimit": 3
  }
}
```

Erros: `401`, `500`.

### `PATCH /api/user/me`

Body (parcial):

```json
{
  "name": "Novo nome",
  "company": "Nova empresa",
  "whatsappNumber": "5511999999999"
}
```

- `whatsappNumber` aceita `string` ou `null`.
- Retorno: mesmo contrato de `GET /api/user/me`.
- Erros: `400`, `401`, `500`.

### `DELETE /api/user/account`

Remove conta autenticada (dados + auth user).

Resposta `200`:

```json
{ "success": true }
```

Erros: `401`, `500`.

### `POST /api/auth/logout`

Encerra sessao.

- Sucesso: `204` sem body.
- Erro: `500` com `{ "error": "Erro ao encerrar sessao." }`.

### 4.2 Dashboard

### `GET /api/dashboard/overview`

Resposta `200`:

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
      "status": "completed"
    }
  ],
  "openTasks": [
    {
      "id": "task-1",
      "text": "Enviar proposta",
      "completed": false,
      "createdAt": "2026-04-10T10:10:00.000Z"
    }
  ],
  "openTaskCount": 1,
  "hoursSaved": 3,
  "todayCount": 1
}
```

Erros: `401`, `500`.

### 4.3 Meetings

### `GET /api/meetings`

Resposta `200`:

```json
{
  "meetings": [
    {
      "id": "meeting-1",
      "title": "Kickoff",
      "clientName": "Acme",
      "createdAt": "2026-04-10T10:00:00.000Z",
      "status": "completed"
    }
  ]
}
```

Erros: `401`, `500`.

### `POST /api/meetings/upload`

Body:

```json
{
  "fileName": "audio.mp3",
  "contentType": "audio/mpeg",
  "fileSize": 1024
}
```

Resposta `200`:

```json
{
  "r2Key": "meetings/user-id/.../audio.mp3",
  "uploadUrl": "https://...",
  "uploadToken": "signed-token",
  "method": "PUT",
  "expiresInSeconds": 900
}
```

Erros comuns: `400`, `403` (limite do plano), `413` (arquivo > 500MB), `415`, `422`, `429`, `500`.

### `POST /api/meetings/process`

Body:

```json
{
  "clientName": "Acme",
  "meetingDate": "2026-04-10",
  "r2Key": "meetings/user-id/.../audio.mp3",
  "uploadToken": "signed-token",
  "whatsappNumber": "(11) 98888-7777"
}
```

Sucesso novo registro (`201`):

```json
{ "meetingId": "meeting-1", "status": "pending" }
```

Se upload ja registrado (`200`):

```json
{ "meetingId": "meeting-1", "status": "pending" }
```

Erros comuns: `400`, `403`, `409`, `413`, `422`, `429`, `500`, `503`.

### `GET /api/meetings/{id}`

Retorna reuniao completa + relacoes (`tasks`, `decisions`, `open_items`).

Resposta `200` (shape resumido):

```json
{
  "id": "meeting-1",
  "user_id": "user-1",
  "title": "Reuniao - Acme",
  "client_name": "Acme",
  "meeting_date": "2026-04-10",
  "status": "completed",
  "summary_whatsapp": "...",
  "summary_json": {},
  "transcript": "...",
  "tasks": [],
  "decisions": [],
  "open_items": [],
  "created_at": "2026-04-10T10:00:00.000Z",
  "completed_at": "2026-04-10T10:03:00.000Z"
}
```

Erros: `401`, `403`, `500`.

### `PATCH /api/meetings/{id}`

Body parcial (ao menos 1 campo):

```json
{
  "title": "Novo titulo",
  "clientName": "Nova empresa",
  "meetingDate": "2026-04-10"
}
```

Resposta `200`:

```json
{
  "id": "meeting-1",
  "title": "Novo titulo",
  "clientName": "Nova empresa",
  "meetingDate": "2026-04-10"
}
```

Erros: `400`, `401`, `403`, `500`.

### `DELETE /api/meetings/{id}`

Resposta `200`:

```json
{ "success": true }
```

Comportamento idempotente (se ja foi excluida, continua retornando sucesso).

### `GET /api/meetings/{id}/status`

Resposta `200`:

```json
{
  "id": "meeting-1",
  "title": "Reuniao - Acme",
  "status": "processing",
  "taskCount": 2,
  "decisionCount": 1
}
```

Erros: `401`, `403`, `500`.

### `POST /api/meetings/{id}/retry`

Reenfileira processamento (somente para reunioes com `status=failed`).

Resposta `200`:

```json
{ "success": true, "meetingId": "meeting-1" }
```

Erros comuns: `400`, `401`, `403`, `409`, `422`, `500`.

### `POST /api/meetings/{id}/resend`

Reenvia resumo no WhatsApp (max 3 reenvios por reuniao).

Resposta `200`:

```json
{
  "success": true,
  "whatsapp_status": "sent",
  "resends_remaining": 2
}
```

Erros comuns: `400`, `401`, `403`, `429`, `502`, `500`.

### `POST /api/meetings/{id}/export`

Endpoint reservado para exportacao.

Resposta atual `200`:

```json
{ "success": true, "meetingId": "meeting-1" }
```

### 4.4 Tasks

### `GET /api/tasks`

Resposta `200`:

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
          "meetingSource": "Acme",
          "dueDate": "2026-04-12",
          "assignee": { "name": "Gabriel" },
          "assignees": [{ "name": "Gabriel" }],
          "generatedByAI": true
        }
      ]
    }
  ],
  "meetings": [
    {
      "id": "meeting-1",
      "title": "Kickoff",
      "clientName": "Acme",
      "label": "Acme - Kickoff"
    }
  ]
}
```

Erros: `401`, `500`.

### `POST /api/tasks`

Body minimo:

```json
{
  "meeting_id": "meeting-1",
  "description": "Enviar proposta"
}
```

Body opcional:

- `priority`: `alta | media | baixa` (internamente persiste `média` quando `media`)
- `owner`: `string | null`
- `due_date`: `YYYY-MM-DD` ou `null`
- `status` ou `kanban_status`: `todo | in_progress | completed`
- `completed`: `boolean` (fallback)

Resposta `201`:

```json
{ "task": { "id": "task-1", "title": "Enviar proposta", "columnId": "todo", "priority": "media" } }
```

Erros comuns: `400`, `401`, `403`, `500`.

### `PATCH /api/tasks/{id}`

Body parcial (qualquer subset dos campos editaveis):

```json
{
  "description": "Enviar proposta revisada",
  "priority": "alta",
  "owner": "Ana",
  "due_date": "2026-04-13",
  "status": "in_progress"
}
```

Resposta `200`:

```json
{ "task": { "id": "task-1", "title": "Enviar proposta revisada" } }
```

Erros comuns: `400`, `401`, `403`, `500`.

### `DELETE /api/tasks/{id}`

Resposta `200`:

```json
{ "success": true }
```

Erros comuns: `400`, `401`, `403`, `500`.

### 4.5 Billing / Checkout

#### AbacatePay (fluxo principal atual)

### `POST /api/abacatepay/customer/ensure`

- `200`: `{ "success": true, "customerId": "..." }`
- `202`: `{ "success": false, "inProgress": true }`
- Erros: `401`, `500`, `504`.

### `POST /api/abacatepay/checkout`

Body:

```json
{ "plan": "pro" }
```

Sucesso:

- `{ "checkoutUrl": "https://..." }`
- ou `{ "alreadyActive": true, "plan": "pro" }`

Erros comuns: `400`, `401`, `429`, `500`, `503`.

### `POST /api/abacatepay/checkout/verify`

Sem body.

Sucesso:

```json
{ "success": true, "plan": "pro" }
```

Erros comuns: `401`, `403`, `404`, `409`, `500`.

#### Stripe (alternativo)

### `POST /api/stripe/checkout`

Body:

```json
{ "plan": "pro" }
```

Sucesso:

- `{ "checkoutUrl": "https://checkout.stripe.com/..." }`
- ou `{ "alreadyActive": true, "plan": "pro" }`

Erros comuns: `400`, `401`, `429`, `500`.

### `POST /api/stripe/checkout/verify`

Body:

```json
{ "sessionId": "cs_test_..." }
```

Sucesso:

```json
{ "success": true, "plan": "pro", "paymentStatus": "paid" }
```

Erros comuns: `400`, `401`, `403`, `409`, `429`, `500`.

### 4.6 Transcricao em tempo real

### `POST /api/assemblyai/token`

Retorna token temporario para transcricao realtime da AssemblyAI.

Resposta `200`:

```json
{ "token": "jwt-temporario" }
```

Erros comuns: `401`, `429`, `500`, `502`.

## 5) Endpoints de integracao/internos (nao chamar do mobile)

Estas rotas sao para integracoes server-to-server ou infraestrutura:

- `POST /api/webhooks/abacatepay`
- `POST /api/webhooks/assemblyai`
- `POST /api/webhooks/stripe`
- `GET /api/internal/health`
- `GET|POST|PUT /api/inngest`
- `GET /api/sentry-example-api` (teste de observabilidade)

## 6) Matriz de rate-limit por rota

- `POST /api/meetings/upload`: `10 req / 60s`
- `POST /api/meetings/process`: `20 req / 60s`
- `POST /api/assemblyai/token`: `30 req / 60s`
- `POST /api/stripe/checkout`: `10 req / 300s`
- `POST /api/stripe/checkout/verify`: `30 req / 60s`
- `POST /api/abacatepay/checkout`: `10 req / 300s`
- `POST /api/abacatepay/checkout/verify`: `30 req / 60s`
- `POST /api/webhooks/stripe`: `120 req / 60s`
- `POST /api/webhooks/abacatepay`: `120 req / 60s`
- `POST /api/webhooks/assemblyai`: `120 req / 60s`
- `GET /api/internal/health`: `240 req / 60s`

## 7) Checklist operacional para agentes Codex

- Sempre tratar `401` como sessao expirada/ausente.
- Sempre tratar `403` como ownership/permissao.
- Em `429`, respeitar `Retry-After`.
- No fluxo de reuniao, **nunca** pular `upload -> process`.
- Para polling de processamento, usar `GET /api/meetings/{id}/status` (payload leve).
- Ao finalizar processamento, usar `GET /api/meetings/{id}` para payload completo.
