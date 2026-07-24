---
description: Lê o grafo de dependências do Linear e lista o que está desbloqueado agora
allowed-tools: mcp__linear__list_issues, mcp__linear__get_issue, mcp__supabase__execute_sql
---

# /desbloqueados

Responde uma pergunta só: **o que eu posso pegar agora sem esbarrar em dependência?**

Não cria issue, não muda status, não escreve nada no Linear. É leitura.

## Constantes confirmadas (24/07/2026)

- Time: `GH` (id `c70ac69c-02a8-46e8-919f-48eccecab3c5`)
- Projeto Notura: `effed4da-97ae-4bbe-b21b-0096622e5234`
- Henry: `1f3b0c97-07d5-4afd-b5d8-5b04b171235a`
- Gabriel: `2f22206a-e1ae-4975-bbbd-066e1a784c2b`
- Supabase Notura: `veugfrzbghmojzmrmrul`

**Escopo é o TIME `GH`, não o projeto.** Issues do cluster de Retenção (NOT-99/100/101)
não estão em projeto nenhum. Filtrar por projeto perde parte do grafo.

## Passo 1 — Candidatos

`list_issues` com `team: "GH"`, `limit: 250`, `includeArchived: false`.

Mantém só `statusType` em `unstarted` ou `started`.
Descarta `backlog`, `completed`, `canceled`, `duplicate`.

Backlog fica de fora de propósito: não é trabalho candidato desta semana,
e incluir dobra o custo do passo 2 sem mudar a decisão.

## Passo 2 — Relações (o passo caro)

`list_issues` NÃO devolve `blockedBy`. Para cada candidato do passo 1, chamar
`get_issue` com `includeRelations: true`.

Se passarem de 40 candidatos, priorizar `priority` 1 e 2 e avisar no output
quantos ficaram sem checagem.

## Passo 3 — Classificar

Para cada candidato, olhar `relations.blockedBy`:

- **DESBLOQUEADO** — `blockedBy` vazio, ou todos os bloqueadores com
  `statusType` = `completed` ou `canceled`.
- **BLOQUEADO** — pelo menos um bloqueador aberto. Registrar quem é.

Dois ajustes:

- **Épico com filhos abertos não é trabalho.** Se a issue aparece como
  `parentId` de algum candidato aberto, marcar como `épico` e tirar da lista
  principal. Ex.: NOT-87 é guarda-chuva do app mobile, não uma task.
- **Filho de épico é trabalho.** Continua na lista normalmente.

## Passo 4 — Ordenar

Dentro dos desbloqueados:

1. `dueDate` vencida ou nos próximos 7 dias
2. `priority` (1 Urgent → 4 Low)
3. Quantas issues ela desbloqueia (`relations.blocks` maior primeiro) — destrava mais grafo
4. `updatedAt` mais antigo (o que está parado há mais tempo)

## Passo 5 — Output

Separar por dono, porque o cluster do Gabriel roda independente:

```
## Desbloqueado — Henry (N)

| Issue | Título | Prio | Prazo | Destrava | Parado há |
|-------|--------|------|-------|----------|-----------|

## Desbloqueado — Gabriel (N)
(mesma tabela)

## Sem dono (N)
(mesma tabela)

## Bloqueado (N)

| Issue | Esperando |
|-------|-----------|

## Épicos abertos
NOT-87 — 2 de 3 fatias concluídas

## Ruído do grafo
- Issues sem projeto: ...
- Issues com dependência só descrita no texto, sem blockedBy real: ...
```

**Fechar com uma recomendação de uma linha:** qual pegar agora e por quê.
Não listar as dez — escolher uma.

## Passo 6 — Ruído do grafo (o valor escondido)

Muita dependência do Notura está escrita em prosa na descrição
("Depende da Fatia 1", "Bloqueia NOT-100") e nunca virou `blockedBy` de verdade.
Dependência em prosa não é lida por máquina nenhuma.

Ao ler as descrições, sinalizar quando um `NOT-XXX` é citado com verbo de
dependência mas não existe relação formal correspondente. **Sinalizar, não criar.**
Escrita no Linear passa pelo gate humano.

## Passo 7 — Registro (opcional, só se o usuário pedir)

Se ele fechou um ticket, oferecer o insert em `dev_metrics`:

```sql
insert into public.dev_metrics
  (ticket_id, titulo, agente, rodadas_ate_aceite, motivo_rejeicao, horas_gate, spec_em, merge_em)
values ('NOT-XXX', '...', 'claude_code', 1, null, 0.5, '...', '...');
```

Lembrar: `rodadas_ate_aceite > 1` exige `motivo_rejeicao` — o banco rejeita sem isso.
Vocabulário: `sem_evidencia`, `spec_ambigua`, `bug_funcional`, `escopo_extrapolado`,
`conflito_merge`, `outro`.

## Regras

- Nunca inventar relação que a API não devolveu. Sem `blockedBy` = sem bloqueio,
  e o Passo 6 avisa se isso parece errado.
- Nunca escrever no Linear.
- Se `list_issues` vier vazio ou der erro, dizer isso e parar. Não improvisar.
