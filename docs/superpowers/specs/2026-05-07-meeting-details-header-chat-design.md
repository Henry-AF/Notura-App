# Meeting Details Header Chat Design

**Goal:** remover os botões suspensos próprios da tela de detalhes da reunião e mover a entrada do chat de IA para o header, ao lado de `Compartilhar`.

## Context

A tela `src/app/dashboard/meetings/[id]/meeting-detail-client.tsx` hoje usa dois componentes com botão flutuante próprio:

- `src/components/meeting-detail/AIInsightToast.tsx`
- `src/components/meeting-detail/MeetingChatSheet.tsx`

O layout global já possui um botão fixo de suporte (`WhatsAppSupportButton`), então manter outros FABs nessa tela cria ruído visual e redundância. O header da reunião já concentra as ações primárias (`Compartilhar`, `Editar`, `Excluir`) e é o lugar mais consistente para expor o acesso ao chat.

## Decision

1. Remover o uso de `AIInsightToast` da tela de detalhes.
2. Remover `AIInsightToast` da codebase e do barrel file de `meeting-detail`.
3. Adaptar `MeetingChatSheet` para funcionar sem FAB embutido, controlado por `open` e `onOpenChange`.
4. Adicionar ao `MeetingHeader` um botão `outline` com ícone + texto `Chat`, posicionado ao lado de `Compartilhar`.
5. Na `meeting-detail-client`, conectar o botão do header ao `MeetingChatSheet`, mantendo a regra atual: o chat só fica disponível para reuniões com status `completed`.

## UX Notes

- O botão `Chat` segue o estilo do botão `Compartilhar` para manter consistência visual.
- O botão de suporte global continua como único elemento suspenso persistente da interface.
- Em reuniões não concluídas, o header não deve expor ação de chat indisponível.

## Testing

Adicionar testes de regressão leves no padrão atual do repositório para verificar que:

- `MeetingHeader` contém o botão `Chat`
- `meeting-detail-client` não usa mais `AIInsightToast`
- `MeetingChatSheet` não renderiza mais FAB fixo
- o barrel `src/components/meeting-detail/index.ts` não exporta mais `AIInsightToast`
