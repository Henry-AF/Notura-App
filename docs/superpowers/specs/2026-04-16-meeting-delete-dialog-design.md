# Meeting Delete Dialog Design

**Goal**

Adicionar exclusao permanente de reunioes em `dashboard/meetings/[id]`, com confirmacao explicita por texto, opcao de copiar o resumo inteligente antes da perda de dados, remocao do arquivo de audio no R2 e UX mobile-first.

**Architecture**

A tela de detalhe da reuniao continuara sem acesso direto a dados sensiveis. A UI chamara um helper companion em `meeting-api.ts`, que por sua vez consumira `DELETE /api/meetings/[id]`. A rota delegara a exclusao para um helper em `@/lib/meetings/delete`, responsavel por validar ownership, remover o arquivo do R2 e excluir a reuniao de forma idempotente.

**Design**

- Adicionar uma nova acao de perigo no header da reuniao.
- Abrir um `Dialog` reutilizavel com:
  - alerta de operacao sem volta
  - botao para copiar o resumo inteligente
  - input que exige `Confirmar`
  - CTA destrutivo para excluir
- Em sucesso, mostrar toast e redirecionar para `/dashboard/meetings`.

**Idempotency**

- Repetir a mesma requisicao de exclusao nao deve quebrar a UI.
- Se a reuniao ja nao existir mais para o usuario autenticado, a API respondera sucesso logico.
- A exclusao do arquivo no R2 sera tolerante a ausencia do objeto.

**Files**

- Modify: `src/app/dashboard/meetings/[id]/meeting-detail-client.tsx`
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.ts`
- Modify: `src/app/dashboard/meetings/[id]/meeting-api.test.ts`
- Modify: `src/app/api/meetings/[id]/route.ts`
- Modify: `src/app/api/meetings/[id]/route.test.ts`
- Create: `src/lib/meetings/delete.ts`
- Create: `src/lib/meetings/delete.test.ts`
- Create: `src/components/meeting-detail/MeetingDeleteDialog.tsx`
- Modify: `src/components/meeting-detail/MeetingHeader.tsx`
- Modify: `src/components/meeting-detail/index.ts`

**Testing**

- Companion API test para `deleteMeetingById`.
- Route/lib tests para:
  - exclusao bem-sucedida
  - delete idempotente
  - ownership invalido
  - falha ao remover arquivo no R2
- Verificacao final com os testes focados da feature.
