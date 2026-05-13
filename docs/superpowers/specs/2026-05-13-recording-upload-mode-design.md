# Recording Upload Mode Design

**Goal:** adicionar um terceiro modo de `upload` em `src/app/dashboard/recording/page.tsx`, mantendo os modos `presencial` e `remota`, para aposentar `src/app/dashboard/new/page.tsx` como ponto principal de entrada.

## Context

Hoje a tela de `src/app/dashboard/recording/page.tsx` cobre apenas gravação ao vivo, com os modos `in-person` e `remote` definidos em `src/components/recording/RecordingSetupCard.tsx`.

A tela de `src/app/dashboard/new/page.tsx` já implementa o fluxo de upload manual com:

- `DropZone` para seleção do arquivo
- `MeetingForm` com nome do cliente, data da reunião e WhatsApp
- upload direto para R2 via `initMeetingUpload`
- registro/processamento via `processUploadedMeeting`

O objetivo do produto é concentrar esses fluxos em uma única tela de entrada para reuniões, sem perder o comportamento atual de gravação ao vivo.

## Decision

Transformar `dashboard/recording` em um hub com três modos no mesmo `SegmentedControl`:

- `in-person`
- `remote`
- `upload`

O modo `upload` não substitui a gravação ao vivo. Ele apenas alterna o conteúdo principal do card esquerdo para exibir o fluxo de upload manual.

## UI Behavior

Quando o modo ativo for `in-person` ou `remote`:

- manter o comportamento atual da tela
- manter o formulário de gravação
- manter o overlay de gravação/salvamento

Quando o modo ativo for `upload`:

- renderizar o `DropZone` usado hoje em `dashboard/new`
- renderizar o formulário com nome do cliente, data da reunião e WhatsApp
- exibir esses campos apenas nesse modo
- ocultar toda a mecânica de gravação ao vivo, incluindo botão de iniciar e overlay

O `SegmentedControl` passa a ter tema amarelo no estado ativo do modo `upload`, seguindo a linguagem visual já associada ao CTA de upload/nova reunião na dashboard.

## Architecture

Evitar duplicação do fluxo de `dashboard/new`.

O reaproveitamento deve seguir estas regras:

- `src/app/dashboard/recording/page.tsx` continua como orquestrador da experiência
- a lógica de upload deve reutilizar os helpers já existentes em `src/app/dashboard/new/new-api.ts` ou, se necessário para reduzir acoplamento, ser extraída para um helper compartilhado em `src/lib/meetings/`
- os componentes de formulário e seleção de arquivo continuam sendo os já existentes em `src/components/upload/`
- nenhuma chamada de Supabase deve ir para frontend; o modo `upload` continua usando as rotas já existentes

## Routing Changes

Atualizar os links e CTAs que hoje levam para `src/app/dashboard/new/page.tsx` para apontarem para:

- `/dashboard/recording?mode=upload`

Para a transição, `src/app/dashboard/new/page.tsx` deve deixar de ser uma tela de fluxo próprio e passar a redirecionar para `/dashboard/recording?mode=upload`, preservando links antigos enquanto a rota é aposentada.

## State Model

O estado da página de `recording` precisa distinguir claramente os fluxos:

- estado de modo selecionado: `in-person`, `remote`, `upload`
- estado de gravação ao vivo: só existe para `in-person` e `remote`
- estado de upload manual: arquivo selecionado, progresso visual, progresso real de envio

Ao alternar de `upload` para um modo de gravação:

- limpar estados transitórios de upload que não devam vazar entre modos

Ao alternar de gravação para `upload`:

- não abrir overlay
- não manter gravação ativa; se houver gravação em andamento, a UI deve impedir troca de modo ou encerrar/resetar explicitamente

## Error Handling

No modo `upload`, manter os comportamentos já existentes:

- validação de formato e tamanho no `DropZone`
- validação de data via `validateMeetingDate`
- mensagens de erro via `ToastProvider`

No modo de gravação, nada muda no comportamento de erro atual.

## Testing

Cobrir o novo comportamento com testes focados em regressão:

- teste do `RecordingSetupCard` validando a terceira opção `upload`
- teste da página ou do fluxo auxiliar confirmando que o modo `upload` exibe `DropZone` e formulário com data
- teste confirmando que `in-person` e `remote` continuam exibindo o fluxo de gravação
- teste do redirect de `dashboard/new` para `dashboard/recording?mode=upload`
- testes dos helpers de upload ajustados, caso a lógica seja extraída ou reaproveitada

## Non-Goals

- alterar as rotas de backend de upload/processamento
- mudar o fluxo de processamento pós-upload
- refatorar o overlay de gravação além do necessário para coexistir com o novo modo
