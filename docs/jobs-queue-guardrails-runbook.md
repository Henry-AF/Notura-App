# Runbook: Guardrails de fila para jobs

Data: 2026-04-11
Escopo: pipeline `meeting/process` (Inngest)

## Objetivo

Definir comportamento previsivel para falhas de provider e evitar processamento duplicado da mesma reuniao.

## Politicas implementadas

### 1. Concorrencia por recurso

- Job: `process-meeting`
- Regra: `concurrency = { limit: 1, key: "event.data.meetingId", scope: "fn" }`
- Efeito: apenas 1 execucao por `meetingId` pode rodar ao mesmo tempo.

### 2. Retry/backoff por tipo de erro

- Tentativas base do job: `retries = 4`
- Classificacao de erro de provider:

| Tipo | Sinal | Comportamento |
|---|---|---|
| Transiente | status `408/409/425/429/5xx`, timeout, erro de rede | `RetryAfterError` com backoff especifico por provider |
| Permanente | status `400/401/403/404/410/413/422`, payload invalido, transcript unprocessable | `NonRetriableError` (falha rapida, sem retry adicional) |

Backoff por provider:

- `assemblyai`: 120s
- `gemini`: 45s
- `r2`: 30s

### 3. Replay/manual retry

- Endpoint: `POST /api/meetings/:id/retry`
- Regra nova: apenas reunioes com status `failed` podem ser reenfileiradas manualmente.
- Requisicoes para `pending`, `processing` ou `completed` retornam `409`.

## Procedimento operacional

### A. Falha transiente de provider (ex.: 429/timeout/503)

1. Confirmar no erro/log que a falha e transiente.
2. Nao disparar replay manual imediato em massa.
3. Aguardar retries automaticos com backoff do job.
4. Se o provider normalizar e ainda houver reunioes `failed`, executar replay manual em lotes pequenos.

### B. Falha permanente (payload invalido, transcript ruim, etc.)

1. Confirmar no erro/log que a falha e nao-retryable.
2. Nao insistir no mesmo payload sem correcao.
3. Corrigir causa raiz (audio, integracao, dados).
4. Depois da correcao, executar replay manual para as reunioes afetadas.

## Passo a passo para replay manual

1. Validar ownership e status `failed` da reuniao.
2. Executar `POST /api/meetings/:id/retry` autenticado como dono.
3. Esperado:
   - `200` com `{ success: true, meetingId }`
   - status da reuniao volta para `pending`
   - evento `meeting/process` reenfileirado
4. Acompanhar logs estruturados (`requestId`, `route`, `status`) e evento no Sentry em caso de nova falha.

## Sinais de observabilidade para acompanhar

- Logs:
  - `inngest.job.completed`
  - `inngest.job.failed`
- Contexto minimo:
  - `requestId`
  - `route`
  - `durationMs`
  - `status`
  - `userId` (quando disponivel)
- Tracking de erro em producao:
  - evento no Sentry com `functionId` e `meetingId` quando houver excecao.

## Limites e decisoes conscientes

- Falhas de envio de WhatsApp continuam best-effort (nao derrubam o pipeline inteiro).
- `meeting/process` invalido agora falha como nao-retryable para evitar repeticao inutil.
- Reprocessamento manual ficou mais restrito para reduzir duplicidade de fila.
