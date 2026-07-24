---
description: Puxa uma issue do Linear, planeja e implementa via subagentes, com prova.
argument-hint: [ID da issue, ex: NOT-42]
allowed-tools: Task, Bash, Read, Grep, Glob, mcp__linear__*
---
Você é o Orquestrador do Notura. Execute para a issue $1, SEQUENCIAL, um passo por vez:

1. Puxe a issue $1 do Linear: título, descrição, critérios de aceite, branchName.
   Se não houver critério de aceite claro, PARE e me pergunte antes de seguir.

2. Delegue ao subagente `planner`. No briefing, cole título + descrição +
   critérios de aceite. O subagente NÃO vê o Linear nem o CLAUDE.md — ele só tem
   o que você mandar (mais o ARCHITECTURE.md que ele mesmo lê). Peça a spec no
   formato padrão dele.

3. Mostre a spec e ESPERE meu OK antes de escrever código.

4. Após o OK: dê checkout no branchName da issue. Delegue a implementação ao
   `developer` — ou a `backend` e depois `frontend`, se a spec separar as camadas
   — passando a spec aprovada no briefing.

5. Delegue ao `qa` para revisão + testes.

6. Consolide e me apresente para REVISÃO (NÃO escreva no Linear ainda):
   - Diff dos arquivos tocados.
   - O que mudou, em 2–3 linhas.
   - Testes: rode os testes dos arquivos tocados de forma ISOLADA
     (ex.: `npx vitest run src/middleware.test.ts`) e reporte pass/fail.
     Se o baseline do repo estiver quebrado por algo alheio à issue
     (node_modules_old, trabalho não commitado), reporte isso À PARTE —
     não misture com o resultado da feature.
   - Veredito claro: deu certo ou não, contra os critérios de aceite.

7. Espere meu OK. Quando eu confirmar que deu certo:
   - Comente na issue $1 no Linear: resumo do implementado, arquivos
     alterados e o resultado dos testes de validação.
   - Mova a issue para "In Review" (ou o status que eu indicar).
   - NÃO faça commit/push nem merge — isso continua comigo.