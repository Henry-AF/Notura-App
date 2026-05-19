# Groups Shared Meetings List Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reutilizar o mesmo padrão de lista de dashboard na tela de grupos para exibir as reuniões de cada grupo, mantendo a coluna vertical de grupos e deixando explícito qual grupo está sendo mostrado

**Architecture:** vamos extrair a casca estrutural da lista tabular de dashboard para um componente compartilhado de apresentação, sem mover lógica de negócio para ele. Depois, a tela de reuniões passa a usar esse wrapper extraído e a tela de grupos substitui sua lista simplificada por uma composição nova com contexto do grupo, ação de adicionar reunião e linhas alinhadas ao padrão de reuniões.

**Tech Stack:** Next.js 14, React 18, TypeScript strict, Tailwind classes, Vitest

---

## Chunk 1: Extrair o wrapper compartilhado da lista

### Task 1: Criar o contrato visual compartilhado com teste de source

**Files:**
- Create: `src/components/ui/app/dashboard-list-section.tsx`
- Create: `src/components/ui/app/dashboard-list-section.test.ts`
- Modify: `src/components/ui/app/index.ts`
- Test: `src/components/ui/app/dashboard-list-section.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `src/components/ui/app/dashboard-list-section.test.ts` validando por leitura de source que o novo componente:

- exporta `DashboardListSection`
- aceita props para `actions`, `emptyState`, `header` e `children`
- renderiza `SectionCard` internamente
- usa um bloco opcional para cabeçalho de colunas e outro para estado vazio

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/app/dashboard-list-section.test.ts`
Expected: FAIL because the component file and barrel export do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Criar `src/components/ui/app/dashboard-list-section.tsx` como componente puramente de composição para:

- encapsular `SectionCard`
- renderizar uma faixa superior opcional com contexto e ações
- renderizar um cabeçalho opcional de colunas em desktop
- renderizar `children` quando houver conteúdo
- renderizar `emptyState` quando informado

Atualizar `src/components/ui/app/index.ts` para exportar o novo componente.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/app/dashboard-list-section.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/app/dashboard-list-section.tsx src/components/ui/app/dashboard-list-section.test.ts src/components/ui/app/index.ts
git commit -m "feat(ui): add shared dashboard list section"
```

## Chunk 2: Migrar a página de reuniões para o wrapper compartilhado

### Task 2: Cobrir a extração na tela de reuniões sem mudar comportamento

**Files:**
- Modify: `src/app/dashboard/meetings/meetings-client.tsx`
- Modify: `src/app/dashboard/meetings/meetings-client.test.ts`
- Test: `src/app/dashboard/meetings/meetings-client.test.ts`

- [ ] **Step 1: Write the failing test**

Expandir `src/app/dashboard/meetings/meetings-client.test.ts` para verificar no source que:

- `meetings-client.tsx` importa `DashboardListSection`
- o cabeçalho de colunas continua presente com `Cliente / Titulo`, `Data`, `Status` e `Ações`
- o estado vazio de reuniões continua existindo dentro do wrapper compartilhado

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/meetings/meetings-client.test.ts`
Expected: FAIL because `meetings-client.tsx` ainda usa `SectionCard` diretamente.

- [ ] **Step 3: Write minimal implementation**

Refatorar `src/app/dashboard/meetings/meetings-client.tsx` para:

- trocar o `SectionCard` local por `DashboardListSection`
- manter a `MeetingRow` atual intacta
- manter filtros, retry, navegação e estado vazio com o mesmo comportamento
- preservar o cabeçalho de colunas já existente, apenas movendo-o para o slot do wrapper

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/meetings/meetings-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Run focused regression**

Run: `npm test -- src/components/ui/app/dashboard-list-section.test.ts src/app/dashboard/meetings/meetings-client.test.ts`
Expected: PASS with exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/meetings/meetings-client.tsx src/app/dashboard/meetings/meetings-client.test.ts
git commit -m "refactor(meetings): use shared dashboard list section"
```

## Chunk 3: Integrar a lista compartilhada na tela de grupos

### Task 3: Cobrir a nova apresentação do grupo selecionado

**Files:**
- Create: `src/app/dashboard/groups/groups-client.test.ts`
- Modify: `src/app/dashboard/groups/groups-client.tsx`
- Test: `src/app/dashboard/groups/groups-client.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `src/app/dashboard/groups/groups-client.test.ts` validando por leitura de source que:

- `groups-client.tsx` importa `DashboardListSection`
- o painel direito identifica explicitamente o grupo selecionado com `Grupo:`
- a ação `Adicionar reuniao` aparece integrada ao topo da lista compartilhada
- o estado vazio `Grupo vazio` continua existindo para grupos sem reuniões
- o estado `Selecione um grupo` continua existindo quando nenhum grupo está ativo

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/groups/groups-client.test.ts`
Expected: FAIL because the current panel still uses a local `SectionCard` + standalone `Select`.

- [ ] **Step 3: Write minimal implementation**

Refatorar `src/app/dashboard/groups/groups-client.tsx` para:

- substituir o bloco atual de reuniões por `DashboardListSection`
- mostrar no topo da lista algo como `Grupo: {nome}` e a contagem de reuniões
- mover a ação de adicionar reunião para a área de ações do wrapper compartilhado
- adaptar a `MeetingRow` local para ficar alinhada ao padrão visual de reuniões, preservando a ação de remover do grupo
- manter a coluna esquerda de grupos sem alterações estruturais

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/groups/groups-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Run broader verification**

Run: `npm test -- src/components/ui/app/dashboard-list-section.test.ts src/app/dashboard/meetings/meetings-client.test.ts src/app/dashboard/groups/groups-client.test.ts src/app/dashboard/groups/groups-api.test.ts`
Expected: PASS with exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/groups/groups-client.tsx src/app/dashboard/groups/groups-client.test.ts
git commit -m "feat(groups): reuse shared meetings list"
```

## Chunk 4: Final verification

### Task 4: Confirmar que a mudança ficou estável antes de encerrar

**Files:**
- Modify: `src/components/ui/app/dashboard-list-section.tsx`
- Modify: `src/app/dashboard/meetings/meetings-client.tsx`
- Modify: `src/app/dashboard/groups/groups-client.tsx`
- Test: `src/components/ui/app/dashboard-list-section.test.ts`
- Test: `src/app/dashboard/meetings/meetings-client.test.ts`
- Test: `src/app/dashboard/groups/groups-client.test.ts`

- [ ] **Step 1: Run the full focused suite fresh**

Run: `npm test -- src/components/ui/app/dashboard-list-section.test.ts src/app/dashboard/meetings/meetings-client.test.ts src/app/dashboard/groups/groups-client.test.ts src/app/dashboard/groups/groups-api.test.ts`
Expected: PASS with exit code 0.

- [ ] **Step 2: Run production-oriented verification**

Run: `npm run build`
Expected: successful Next.js production build with no type errors from the shared list extraction.

- [ ] **Step 3: Commit final polish if needed**

```bash
git add src/components/ui/app/dashboard-list-section.tsx src/app/dashboard/meetings/meetings-client.tsx src/app/dashboard/groups/groups-client.tsx src/components/ui/app/dashboard-list-section.test.ts src/app/dashboard/meetings/meetings-client.test.ts src/app/dashboard/groups/groups-client.test.ts
git commit -m "test(ui): verify shared dashboard list integration"
```
