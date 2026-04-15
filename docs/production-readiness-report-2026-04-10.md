# Relatorio de Prontidao para Producao - Notura

Data da analise: 10/04/2026

## Resumo executivo

Estado atual: **base boa, mas ainda com lacunas operacionais importantes**.

Pontos fortes ja implementados:
- Pipeline assincrono com Inngest para processamento de reunioes.
- Idempotencia em itens de resumo (`tasks`, `decisions`, `open_items`) com `upsert + dedupe_key`.
- RLS e ownership em partes criticas (ex.: `meetings/[id]`, `tasks/[id]`).
- Webhooks com verificacao de assinatura/segredo.
- CI com lint + testes + build.

Riscos para ir a prod sem dor de cabeca:
- **Sem rate limiting**.
- **Sem estrategia de cache explicita**.
- **Sem observabilidade estruturada** (logs estruturados, tracing, error tracking).
- Varias rotas privadas ainda sem padrao unico `withAuth`.
- Controles de fila/reprocessamento ainda sem politica operacional completa (concorrencia, runbook, replay, DLQ/logica equivalente).

## Matriz de prontidao (baseline de producao)

| Pilar | Status | Observacao |
|---|---|---|
| Filas e jobs | Parcial | Inngest + retries existe, mas falta governanca operacional mais forte |
| Cache e performance | Parcial | Indices no banco existem, mas sem cache de leitura e sem politicas explicitas de cache HTTP |
| Rate limiting | Nao implementado | Nenhum mecanismo encontrado nos handlers |
| Seguranca de API | Parcial | Boa parte protegida, mas padrao `withAuth` ainda nao esta uniforme em todas as rotas privadas |
| Observabilidade | Nao implementado | Sem Sentry/APM, sem logs estruturados, sem metricas/health endpoint |
| Banco e dados | Parcial | RLS/indices ok, mas ha melhorias de schema/validacao e operacao |
| Entrega e release | Parcial | CI existe; faltam runbooks, smoke de prod e alguns guardrails de deploy |

## Evidencias do repositorio

- Inngest e retries: `src/inngest/process-meeting.ts`
- Endpoint Inngest: `src/app/api/inngest/route.ts`
- Dedupe/idempotencia de resumo: `src/inngest/process-meeting.ts`
- Webhook Stripe com assinatura: `src/app/api/webhooks/stripe/route.ts`
- Webhook AssemblyAI com segredo em header: `src/app/api/webhooks/assemblyai/route.ts`
- Indices de performance dashboard: `supabase/migrations/011_dashboard_overview_perf.sql`
- Constraint de data de reuniao nao futura: `supabase/migrations/010_enforce_meeting_date_not_future.sql`
- Rotas com `withAuth` em partes criticas: `src/app/api/meetings/[id]/route.ts`, `src/app/api/tasks/[id]/route.ts`
- Ausencia de rate limit/cache observada por busca global no `src/`

## Itens P0 (bloqueadores antes de go-live)

1. Implementar rate limiting por rota critica
- Escopo minimo:
  - `/api/meetings/upload`, `/api/meetings/process`, `/api/assemblyai/token`, `/api/abacatepay/*/checkout*`, `/api/stripe/checkout*`, webhooks.
- Recomendacao: janela deslizante por `userId` (autenticado) + fallback por IP.
- Criterio de pronto: rotas respondem `429` com payload padrao e headers de limite.

2. Padronizar auth/ownership em todas as rotas privadas
- Migrar rotas privadas para `withAuth` + `requireOwnership` quando houver `:id`.
- Excecoes: rotas publicas de webhook com assinatura/segredo.
- Criterio de pronto: nenhuma rota privada sem wrapper/padrao centralizado.

3. Observabilidade minima obrigatoria
- Adicionar error tracking (ex.: Sentry) para API routes e jobs Inngest.
- Padronizar logs estruturados com `requestId`, `userId` (quando aplicavel), `route`, `durationMs`, `status`.
- Criterio de pronto: erro em producao gera evento rastreavel com contexto.

4. Health check e readiness
- Criar endpoint interno de health/readiness (dependencias: banco, fila, providers principais).
- Criterio de pronto: monitor externo consegue verificar disponibilidade e degradacao.

5. Guardrails de fila (jobs)
- Definir politicas claras de:
  - concorrencia por recurso (evitar processamento duplicado da mesma reuniao),
  - retries/backoff por tipo de erro,
  - procedimento de replay/manual retry.
- Criterio de pronto: runbook e comportamento previsivel em falhas de provider.

6. Validacao centralizada de ambiente (fail-fast)
- Consolidar validacao de variaveis de ambiente no bootstrap.
- Criterio de pronto: app nao sobe com secret faltando/invalido.

## Itens P1 (primeira semana apos go-live)

1. Cache de leitura para telas pesadas
- Cache curto (ex.: 15-60s) para agregacoes do dashboard e listagens frequentes por usuario.
- Invalidacao em mutacoes relevantes.

2. Politicas HTTP explicitas
- Definir `Cache-Control`/`no-store` conforme rota (evitar comportamento implicito).

3. End-to-end/smoke tests de fluxo critico
- Fluxo minimo: upload -> enqueue -> processamento -> dashboard/meeting detail.
- Rodar smoke no deploy (staging/prod).

4. Reducao de ruido de logs e higiene de PII
- Remover logs verbosos de upload em nivel info/debug em producao.
- Garantir mascaramento de dados sensiveis.

5. Endurecimento de schema
- Considerar migrar `meeting_date` para tipo `date` (hoje e texto com check).
- Validar constraints `NOT VALID` em ambiente de producao apos saneamento.

## Itens P2 (evolucao recomendada)

1. Circuit breaker para providers externos (AssemblyAI, Gemini, WhatsApp, pagamentos).
2. Dashboards de SLO/SLA (latencia p95, taxa de erro, backlog de jobs, tempo medio de processamento).
3. Politicas de retencao e compliance de dados (transcricao/resumo, auditoria de delecao).
4. Feature flags para rollout gradual de mudancas de pipeline.

## Plano enxuto de execucao (14 dias)

### Semana 1 (foco em confiabilidade minima)
- Rate limiting nas rotas criticas.
- Padronizacao `withAuth` em rotas privadas restantes.
- Sentry + logs estruturados + health/readiness.
- Runbook de incidentes e replay de jobs.

### Semana 2 (foco em performance e operacao)
- Cache curto para dashboard/listagens.
- Smoke e2e no pipeline de deploy.
- Hardening de schema/constraints.
- Limpeza de logs e checklist operacional final.

## Checklist final de go-live

- [ ] Rate limiting ativo nas rotas criticas
- [ ] Todas rotas privadas com padrao unico de auth/ownership
- [ ] Error tracking e logs estruturados funcionando
- [ ] Health/readiness monitorado
- [ ] Runbook de incidentes e replay de jobs documentado
- [ ] Cache minimo para leituras quentes
- [ ] Smoke test de fluxo principal rodando no deploy
- [ ] Secrets e env vars validados em startup
- [ ] Politica de backup/retencao confirmada (Supabase + R2)
- [ ] Rollback de deploy testado

## Observacao final

A aplicacao ja esta com uma boa arquitetura de base. O maior ganho para "zero dor de cabeca" em producao vem de **controles operacionais** (rate limit, observabilidade, runbooks e health checks), mais do que de novas features.
