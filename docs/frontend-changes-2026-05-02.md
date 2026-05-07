# Frontend Changes — 2 de maio de 2026

Documento de referência para todas as alterações visuais e estruturais realizadas
nesta sessão de trabalho. Organizado por escopo: globais, componentes UI, rotas
do dashboard, e git.

---

## 1. Sistema de Design — Zero-Border

### Motivação

O arquivo `globals.css` continha a regra `* { @apply border-border; }` dentro de
`@layer base`, que aplicava uma borda visível a **todos** os elementos HTML da
aplicação. O padrão visual adotado usa `box-shadow` para separação de camadas,
sem strokes visíveis.

### `src/app/globals.css`

| Campo | Antes | Depois |
|---|---|---|
| `--background` | `245 244 252` (lavanda) | `247 246 243` (#F7F6F3, creme) |
| Regra global | `* { @apply border-border; }` presente | **Removida** |

O token `--background` afeta o fundo de todas as rotas autenticadas via
`body { background-color: hsl(var(--background)); }`.

---

## 2. Componentes UI Primitivos

### `src/components/ui/card.tsx`

```diff
- "rounded-lg border bg-card text-card-foreground shadow-sm"
+ "rounded-lg bg-card text-card-foreground shadow-sm"
```

Remove `border` do Card base. Como esse componente é usado em todas as rotas
(Settings, Reuniões, Dashboard, etc.), o efeito é global.

---

### `src/components/ui/app/filter-bar.tsx`

```diff
- "flex flex-col gap-3 rounded-lg border bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between"
+ "flex flex-col gap-3 rounded-lg bg-card/70 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
```

Substitui `border` por `shadow-sm` para manter separação visual.

---

### `src/components/ui/app/section-card.tsx`

```diff
- <Card className={cn("border-border/80 bg-card/95", className)} {...props}>
+ <Card className={cn("bg-card/95", className)} {...props}>
```

---

### `src/components/ui/input.tsx`

Aplicado ao `<Input>` e ao `<Textarea>`:

```diff
- "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ..."
+ "flex h-10 w-full rounded-md bg-[#F4F3F1] px-3 py-2 text-sm ... shadow-sm"
```

Remove `border border-input`. Troca `bg-background` por `bg-[#F4F3F1]` para
diferenciar visualmente o campo do fundo creme sem usar borda. O `focus-visible:ring`
(sombra de foco) foi mantido intacto.

---

### `src/components/ui/button.tsx`

Variante `outline`:

```diff
- "border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
+ "bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
```

---

## 3. Tela de Detalhe de Reunião

### `src/components/meeting-detail/MeetingHeader.tsx`

**Antes:** o header renderizava três botões de ação no canto superior direito
(Compartilhar, Editar, Excluir) via a prop `actions` do `PageHeader`.

**Depois:** os botões foram removidos do header. As props `onShare`, `onEdit` e
`onDelete` foram eliminadas da interface `MeetingHeaderProps`. O header exibe
apenas título, data, badge de status e avatares dos participantes.

---

### `src/app/dashboard/meetings/[id]/meeting-detail-client.tsx`

#### 3a. Remoção de strokes inline

Todos os containers com `border: "1px solid rgb(var(--cn-border))"` nas abas
Transcrição, Tarefas, Decisões e Pendências foram trocados por:

```js
boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"
```

Items individuais de Decisões e Pendências também tiveram suas bordas coloridas
removidas (ficam apenas com background rgba):

```diff
// Decisões
- border: "1px solid rgba(108,92,231,0.2)"
// removido — background rgba(108,92,231,0.07) mantido

// Pendências
- border: "1px solid rgba(255,169,77,0.2)"
// removido — background rgba(255,169,77,0.07) mantido
```

O estado `ComingSoon` também teve `border` removido e recebeu `boxShadow`.

#### 3b. Barra de ações flutuante (bottom pill)

Os botões de Compartilhar, Editar e Excluir foram movidos do header para uma
**barra flutuante fixa** na parte inferior da tela:

```
posição: fixed, bottom: 24px, left: 50%, transform: translateX(-50%)
fundo: #FFFFFF, borderRadius: 999, boxShadow: sombra suave
```

Os três botões são separados por divisores finos (`1px rgba(0,0,0,0.1)`).
Excluir usa a cor `#E53935`. O conteúdo principal recebe `paddingBottom: 88px`
para não ficar oculto pela barra.

#### 3c. FAB de chat IA re-adicionado

O `<MeetingChatSheet meetingId={id} />` foi re-importado e renderizado
condicionalmente para reuniões `completed`. O FAB foi movido de `bottom-7` para
`bottom-[90px]` para não sobrepor a barra de ações.

---

### `src/components/meeting-detail/SmartSummaryCard.tsx`

```diff
// Footer AI
- "mt-4 flex items-start gap-2 border-t pt-4"
+ "mt-4 flex items-start gap-2 pt-4"  + style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}

// Blockquote
- "rounded-r-md border-l-2 border-primary bg-primary/10 px-4 py-3 ..."
+ "rounded-r-md bg-primary/10 px-4 py-3 ..."  + style={{ borderLeft: "2px solid rgb(var(--primary))" }}
```

Troca classes Tailwind por inline style para manter o acento visual sem depender
do token `border-border`.

---

### `src/components/meeting-detail/MeetingTabs.tsx`

```diff
- <div className="mt-1 h-px bg-border/50" />
+ <div className="mt-1 h-px" style={{ background: "rgba(0,0,0,0.06)" }} />
```

---

### `src/components/meeting-detail/MeetingChatSheet.tsx`

Posição do FAB ajustada para conviver com a barra de ações inferior:

```diff
- className="fixed bottom-7 right-7 z-40 ..."
+ className="fixed bottom-[90px] right-7 z-40 ..."
```

---

## 4. Listagem de Reuniões

### `src/app/dashboard/meetings/meetings-client.tsx`

```diff
- "hidden grid-cols-[1fr_120px_140px_70px] gap-2 border-b px-3 pb-3 ..."
+ "hidden grid-cols-[1fr_120px_140px_70px] gap-2 px-3 pb-3 ..."
```

Remove `border-b` do cabeçalho de colunas da lista.

---

## 5. Página de Tarefas

### `src/app/dashboard/tasks/page.tsx`

Oito ocorrências de `border: "1px solid rgb(var(--cn-border))"` removidas dos
seguintes elementos:

| Elemento | Substituição |
|---|---|
| `ProductivityPulse` (container) | `boxShadow` padrão |
| `UpcomingDeadlines` — estado vazio | `boxShadow` padrão |
| `UpcomingDeadlines` — estado com itens | `boxShadow` padrão |
| Menu contextual de tarefa (dropdown) | `boxShadow` existente mantido, `border` removido |
| Input de busca | `border` removido |
| Botão "Filtros" | `border` removido |
| Select "Ordenar por" | `border` removido |
| Tabela de tarefas (container) | `boxShadow` padrão |

Adicionalmente:

- **Checkbox de tarefa:** `border: "1.5px solid rgb(var(--cn-border))"` trocado
  por `background: "rgba(0,0,0,0.07)"` quando não marcado.
- **Pills de filtro de status:** `border` condicional removido; estado ativo usa
  `boxShadow: "inset 0 0 0 1.5px #6C5CE7"`, inativo usa `background: "rgba(0,0,0,0.05)"`.
- `thead tr`: `borderBottom: "1px solid rgb(var(--cn-border))"` trocado por
  `borderBottom: "1px solid rgba(0,0,0,0.06)"`.

---

## 6. Página de Upload

### `src/app/dashboard/new/page.tsx`

```diff
- style={{ border: "1px solid rgb(var(--cn-border))", background: "rgb(var(--cn-card))" }}
+ style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)", background: "rgb(var(--cn-card))" }}
```

---

## 7. Git — Estratégia de Branches

### Situação

Todas as alterações acima foram feitas localmente na branch `front-end-meeting-chat`
sem commit. Essa branch já continha o commit `f774196` com a criação do
`MeetingChatSheet`.

### Solução adotada

```bash
# Criar branch limpa a partir do commit do MeetingChatSheet
git checkout -b feat/meeting-chat-sheet

# Descartar todas as mudanças locais não commitadas
git restore .
git clean -fd

# Publicar
git push -u origin feat/meeting-chat-sheet
```

### Estado final das branches

| Branch | Conteúdo |
|---|---|
| `feat/meeting-chat-sheet` | Somente `MeetingChatSheet` (commit `f774196`) — **publicada** |
| `front-end-meeting-chat` | Idem (sem as alterações locais, que foram descartadas) |

As alterações documentadas acima (zero-border, creme, barra de ações, etc.)
estão presentes **apenas no ambiente local** e ainda precisam de um commit
dedicado quando prontas para revisão.

---

## 8. Padrão de Sombra — Referência

Sombras usadas no sistema zero-border:

```js
// Card / container padrão
boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)"

// Elemento elevado (dropdown, modal)
boxShadow: "0 8px 24px rgba(0,0,0,0.15)"

// FAB (botão flutuante IA)
boxShadow: "0 4px 20px rgba(83,65,205,0.45)"

// Barra de ações inferior
boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 1px 6px rgba(0,0,0,0.06)"
```

Token de fundo creme: `--background: 247 246 243` → `#F7F6F3`.
