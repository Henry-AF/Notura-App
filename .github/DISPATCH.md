# Dispatch de issues para agentes de código

Despacho **manual** de uma issue do Linear para o Claude Code ou para o Codex.
O agente implementa, o workflow abre um PR em draft, e o merge continua sendo
seu — com CI verde e revisão, como sempre.

Isto é a v2 da [NOT-163](https://linear.app/notura/issue/NOT-163). A v1 é o
pipeline de triagem diária, que vive em
[`notura-triage`](https://github.com/Henry-AF/notura-triage) e só **identifica**
tarefas. Esta v2 é o passo seguinte: **executar** uma tarefa já identificada,
quando você decidir.

## Como despachar

1. Abra **Actions** no repositório.
2. Escolha **"Dispatch: Claude Code"** ou **"Dispatch: Codex"**.
3. **Run workflow** → preencha `issue_key` com a chave da issue (ex.: `NOT-164`).
4. Opcionalmente preencha `extra_instructions` com contexto que não está na issue.

Não existe gatilho automático, e não vai existir. Escolher qual agente trabalha
em quê é decisão sua, toda vez.

### Por que não é por label

O desenho original previa aplicar um label `dispatch:claude-code` na issue e
deixar o gatilho `issues: labeled` disparar. Isso não funciona aqui: **o
Notura-App não usa issues do GitHub** — o rastreamento inteiro vive no Linear, e
um label aplicado lá não gera nenhum evento no GitHub.

O gatilho é `workflow_dispatch` com a chave da issue. O workflow busca a issue
no Linear pela API e usa título e descrição como prompt. O Linear continua sendo
a fonte única da verdade e nenhuma issue precisa ser espelhada.

Os labels `dispatch:claude-code` e `dispatch:codex` continuam existindo, mas como
**registro, não gatilho**: o workflow aplica o label na issue do Linear ao final,
para você conseguir filtrar depois o que cada agente encostou.

## O que esperar depois

O workflow leva de 5 a 30 minutos, dependendo do tamanho da issue. Ao terminar,
ele comenta na própria issue do Linear com o resultado. Quatro desfechos possíveis:

| Desfecho | O que aconteceu | Job |
|---|---|---|
| PR em draft aberto | O agente alterou arquivos e o PR abriu. O comentário no Linear traz a URL do PR. | verde |
| Nenhum arquivo alterado | O agente rodou e concluiu que não havia o que mudar. Nenhum PR. | **falha de propósito** |
| Alterou arquivos mas nenhum PR abriu | O agente mudou algo, mas o `push`/`gh pr create` não completou. | **falha de propósito** |
| Falhou antes do PR | Erro de credencial, timeout, ou o agente quebrou. O comentário traz o link do run. | falha |

"Nenhum arquivo alterado" e "alterou mas não abriu PR" **fazem o job falhar de
propósito** — não são mais desfechos benignos. Um dispatch verde sem PR esconde
a falha (foi exatamente o modo de falha da NOT-168), então os dois workflows têm
pós-condições depois do comentário no Linear que forçam `exit 1` nesses casos.
O comentário no Linear e o `$GITHUB_STEP_SUMMARY` do run trazem o motivo — no
caso do Codex, incluindo um trecho do relatório final do agente. Essas
pós-condições são protegidas por `tests/dispatch-no-diff-policy.test.ts`.

O PR nasce **em draft** de propósito: é um sinal visível de que aquilo saiu de um
agente e ainda não foi revisado por ninguém. Marque como "ready for review"
quando você mesmo tiver lido o diff.

## Por que o agente não consegue fazer merge

Não é política, é capacidade — ele não tem como, nem que tentasse:

- O `actions/checkout` roda com **`persist-credentials: false`**, então não
  existe credencial de git em disco durante a execução do agente.
- O allowlist de ferramentas do Claude Code **não inclui `git` nem `gh`**. O
  Codex roda com `permission-profile: :workspace`, que dá escrita no diretório
  de trabalho e nada além.
- Quem faz commit, push e abre o PR é o workflow, em steps posteriores, com um
  token que só existe naquele step.
- `gh pr create` abre PR; nunca mergeia. Não há nenhuma chamada de merge em
  lugar nenhum dos dois workflows.

Título e descrição da issue **nunca** são interpolados em shell — chegam sempre
por variável de ambiente. Isso importa porque os títulos das issues criadas pelo
pipeline de triagem são gerados por LLM: tratá-los como texto confiável seria um
caminho de injeção de comando.

## Diferença entre os dois agentes

A `anthropics/claude-code-action` sabe abrir PR sozinha; a `openai/codex-action`
**não** — ela só devolve um `final-message` e as escritas no workspace não
persistem em git por conta própria.

Para os dois ficarem simétricos, os workflows fazem o encanamento de branch,
commit, push e PR por fora, igual para ambos. Efeito colateral bom: nenhum dos
dois precisa de permissão de escrita em git, e o comportamento é o mesmo
independente do agente.

No PR do Codex, a resposta final dele vai num `<details>` no corpo do PR. Quando
não há diff, essa mesma resposta final (truncada a 4000 caracteres) também
aparece no comentário do Linear e no `$GITHUB_STEP_SUMMARY` do run — não é mais
verdade que o corpo do PR é o único lugar onde ela aparece, já que nesse cenário
não existe PR nenhum.

## Padrões do projeto

Os dois agentes leem `ARCHITECTURE.md`: o Claude Code via `CLAUDE.md`, o Codex
via `AGENTS.md`. Os dois arquivos existem e apontam para lá.

O prompt montado pelo workflow ainda reforça explicitamente as regras mais fáceis
de violar (Supabase nunca no frontend, `withAuth` + `requireOwnership` em toda
rota com `:id`, arquivo companion de API e teste para cada página nova) e manda
rodar `npm run lint:changed` e `npm test` antes de terminar.

Se o agente entender que a issue está mal especificada, a instrução é fazer a
menor mudança correta e registrar a ressalva na mensagem final — não inventar
escopo.

## Secrets

Em **Settings → Secrets and variables → Actions** deste repositório.

| Secret | Usado por | Onde gerar |
|---|---|---|
| `ANTHROPIC_API_KEY` | Dispatch: Claude Code | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `OPENAI_API_KEY` | Dispatch: Codex | [platform.openai.com](https://platform.openai.com/api-keys) |
| `LINEAR_API_KEY` | Ambos (buscar issue, comentar, aplicar label) | [linear.app/notura/settings/api](https://linear.app/notura/settings/api) |

Não há secret de GitHub: os workflows usam o `${{ github.token }}` efêmero do
próprio run.

A Claude GitHub App precisa estar instalada no repositório. Instale rodando
`/install-github-app` dentro do Claude Code, como admin do repositório.

## Custo

Cada dispatch é uma execução de agente cobrada na API do fabricante, proporcional
ao tamanho da issue e do repositório. Não há teto configurado nos workflows além
do `timeout-minutes: 45` e do `--max-turns 60` do Claude Code.

Para impedir que o default das actions aumente o custo sem decisão explícita,
os modelos ficam fixados nos workflows:

- Claude Code: `claude-sonnet-4-6`;
- Codex: `gpt-5.6-luna`, variante voltada a workloads sensíveis a custo.

Qualquer troca de modelo deve atualizar também o teste
`tests/dispatch-model-cost-policy.test.ts`. PR continua em draft e merge manual.

## Arquivos

```
.github/workflows/dispatch-claude-code.yml   Workflow do Claude Code
.github/workflows/dispatch-codex.yml         Workflow do Codex
.github/scripts/linear-dispatch.mjs          Ponte com a API do Linear
.github/scripts/dispatch-postconditions.mjs  Pós-condições e relatório comuns
```
