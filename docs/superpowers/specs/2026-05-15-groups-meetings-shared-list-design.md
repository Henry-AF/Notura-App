# Groups Meetings Shared List Design

**Goal:** reaproveitar na tela `src/app/dashboard/groups/groups-client.tsx` o mesmo padrão de lista usado nas páginas de reuniões e chats, mantendo a coluna vertical de grupos como está hoje e deixando explícito a qual grupo a lista de reuniões pertence.

## Context

Hoje a página de grupos já está dividida em duas áreas:

- coluna esquerda com a lista vertical de grupos
- painel direito com o conteúdo do grupo selecionado

O problema atual está restrito ao painel direito. A lista de reuniões do grupo usa uma implementação própria, simplificada, com `MeetingRow` local e um `Select` solto para adicionar reunião. Enquanto isso, `src/app/dashboard/meetings/meetings-client.tsx` e `src/app/dashboard/ai-chats/ai-chats-client.tsx` já seguem um padrão visual mais consistente para listas de dashboard:

- `SectionCard` com padding e estrutura previsíveis
- cabeçalho de colunas em desktop
- linhas com grid responsivo
- estado vazio padronizado
- área de ações claramente integrada ao topo da seção

Como o pedido do produto é mostrar, em Grupos, "a mesma lista usada para listagem de reuniões e de chats", a tela de grupos precisa sair de uma implementação isolada e passar a compartilhar esse padrão visual.

## Decision

Extrair um componente compartilhado de lista tabular para dashboard e reutilizá-lo em:

1. `src/app/dashboard/meetings/meetings-client.tsx`
2. `src/app/dashboard/groups/groups-client.tsx`

O layout geral de `groups` não muda:

- a lista de grupos continua vertical na coluna esquerda
- o painel direito continua mostrando o grupo selecionado

O que muda é apenas a composição interna do painel direito, que passa a renderizar uma lista no mesmo padrão estrutural da tela de reuniões, com contexto explícito do grupo e ação integrada para adicionar reunião.

## Shared List Contract

O componente compartilhado deve encapsular apenas a estrutura da seção de listagem, sem embutir regra de negócio específica de reuniões ou chats.

Ele deve suportar:

- cabeçalho opcional de colunas no desktop
- slot para ações no topo da lista
- slot para conteúdo de linhas
- estado vazio padronizado
- classes configuráveis para manter o visual alinhado ao padrão atual do dashboard

As linhas continuam específicas de cada domínio:

- reuniões continuam com a sua linha de reunião
- chats continuam com a sua linha de chat, se a equipe decidir migrar depois

Para esta mudança, o uso obrigatório é em `meetings` e `groups`. A tela de chats pode permanecer como está se isso reduzir escopo, desde que o componente extraído seja compatível com o padrão que ela já segue.

## Groups UI Behavior

Quando nenhum grupo estiver selecionado:

- o painel direito continua exibindo um `EmptyState` específico pedindo para selecionar um grupo
- a lista compartilhada não deve aparecer nesse estado

Quando um grupo estiver selecionado:

- o `SectionCard` da direita continua com o título geral `Reuniões do grupo`
- dentro dele, a lista compartilhada mostra contexto explícito do grupo selecionado
- esse contexto deve aparecer em destaque no topo do conteúdo, com algo como `Grupo: {nome}` e a contagem de reuniões do grupo

## Add Meeting Action

A ação de adicionar reunião deixa de parecer um controle isolado e passa a fazer parte do topo da lista compartilhada.

Requisitos:

- a ação continua adicionando uma reunião existente ao grupo selecionado
- o fluxo continua usando a lógica atual de `moveMeetingToGroup`
- a ação precisa ficar visualmente integrada ao cabeçalho da lista
- a interação pode continuar usando `Select` internamente, desde que apresentada como ação do bloco da lista e não como campo solto entre seções

## Meeting Row Behavior In Groups

Cada linha da lista de reuniões em grupos continua representando apenas reuniões.

Comportamento esperado:

- clique na linha abre a reunião em `/dashboard/meetings/[id]`
- a linha reutiliza o padrão visual da listagem de reuniões
- a ação secundária de remover do grupo permanece disponível
- a identificação principal da linha continua sendo cliente e título da reunião

Se houver diferenças pequenas de ação entre a página de reuniões e a de grupos, elas devem ser tratadas como composição do conteúdo da linha, não como duplicação de toda a lista.

## Empty States

Precisamos manter dois estados vazios diferentes:

1. Nenhum grupo selecionado
   - estado vazio do painel
   - sem lista renderizada

2. Grupo selecionado sem reuniões
   - estado vazio dentro da lista compartilhada
   - texto contextual ao grupo, orientando a adicionar reuniões existentes ou escolher o grupo ao criar uma nova reunião

## Architecture

Seguir estas diretrizes:

- extrair a estrutura compartilhada para um componente de UI reaproveitável, preferencialmente em `src/components/` ou em uma área compartilhada do dashboard
- evitar mover lógica de dados para o componente compartilhado
- `groups-client.tsx` continua orquestrando seleção de grupo, mutações e estado da página
- `meetings-client.tsx` continua responsável por filtros, retry e navegação

O componente compartilhado deve ser puramente de apresentação/composição.

## Testing

Cobrir a mudança com testes de regressão focados em comportamento:

- teste do componente compartilhado validando cabeçalho, ações e estado vazio
- ajuste dos testes de `meetings-client` para garantir que a lista segue renderizando no mesmo padrão após a extração
- novo teste de `groups-client` validando que o grupo selecionado renderiza a lista compartilhada com identificação explícita do grupo
- teste de `groups-client` validando que a ação de adicionar reunião aparece integrada ao topo da lista

## Non-Goals

- mudar a coluna esquerda de grupos
- incluir chats na tela de grupos
- alterar a origem dos dados de grupos ou reuniões
- redesenhar a página de grupos além do necessário para adotar a lista compartilhada
