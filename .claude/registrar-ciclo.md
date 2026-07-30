---
description: Calcula e registra a métrica de um ticket fechado em dev_metrics, lendo o histórico real do Linear em vez de perguntar ao agente que fez o trabalho.
allowed-tools: mcp__linear__get_issue, mcp__linear__list_comments, mcp__supabase__execute_sql
---

# /registrar-ciclo <ticket_id>

Gatilho: Henry roda manualmente quando confirma que um ticket está de fato fechado
(merge feito, prova validada). Não roda sozinho no fim do `/ship` — fechar é decisão
humana, e essa skill só documenta uma decisão que já foi tomada.

## Princípio que não pode ser quebrado

**O agente nunca inventa `motivo_rejeicao` no momento de fechar.** Julgar a própria
causa de erro é o mesmo viés que o gate de evidência existe para eliminar. O motivo
só pode vir de um comentário de reabertura já escrito antes — nunca gerado agora.

Se a issue foi reaberta sem um comentário classificando o motivo com o vocabulário
fechado (`sem_evidencia`, `spec_ambigua`, `bug_funcional`, `escopo_extrapolado`,
`conflito_merge`, `outro`), a skill NÃO adivinha. Ela para e pergunta a Henry.

## Passo 1 — Coletar

`get_issue(ticket_id)` → `createdAt`, `startedAt`, `completedAt`.
`list_comments(ticket_id)` → histórico completo de comentários.

## Passo 2 — Contar rodadas

Cada comentário que começa com "Reaberto —" (o padrão usado no NOT-114) é uma
rodada de retrabalho. `rodadas_ate_aceite = 1 + número desses comentários`.

Se `rodadas_ate_aceite = 1`: `motivo_rejeicao = null`, segue para o Passo 4.

## Passo 3 — Extrair motivo (só se rodadas > 1)

Ler o último comentário "Reaberto —" antes do fechamento final. Buscar o vocabulário
fechado dentro do texto. Se não achar nenhum termo do vocabulário, **parar e perguntar
a Henry** qual dos seis se aplica — não escolher por conta própria.

## Passo 4 — Aproximar horas_gate

Buscar quando a issue entrou em "In Review" pela última vez (via comentário ou,
na ausência disso, usar a diferença entre o penúltimo evento registrado e
`completedAt`). Isso é uma aproximação, não um relógio real — marcar como estimativa
ao mostrar para Henry.

## Passo 5 — Montar e CONFIRMAR antes de inserir

Nunca insere direto. Monta a linha e mostra:

```
NOT-XXX | agente: ___ | rodadas: N | motivo: ___ | horas_gate: ~X.X (estimado) | spec_em → merge_em
```

Pergunta: "Confere? Ajusta algo antes de eu gravar?" — uma linha, não formulário.
Só após confirmação roda o insert em `public.dev_metrics` (projeto `veugfrzbghmojzmrmrul`).

## Regras

- Nunca infere `motivo_rejeicao` sem comentário de reabertura correspondente.
- Nunca insere sem confirmação explícita de Henry.
- Se o ticket já tem linha em `dev_metrics` (constraint única em `ticket_id`),
  avisa e pergunta se é para atualizar (`update`) em vez de tentar inserir de novo.
