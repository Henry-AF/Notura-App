# Editable Meeting Participants Backend Design

## Goal

Permitir que nomes de participantes reais da reuniao e entidades citadas sejam
editaveis no backend, com cada leitura do resumo refletindo o `display_name`
atual sem reprocessar a reuniao e sem chamar LLM novamente.

## Scope

Esta fase e backend only. Ela cobre schema, pipeline Inngest, prompt Gemini,
validacao, persistencia, leitura hidratada e API para renomear participantes ou
entidades.

Nao inclui UI. O frontend podera consumir os novos dados e chamar as novas rotas
de edicao depois.

## Decisions

Usaremos uma unica chamada Gemini para a reuniao. A mesma chamada que gera o
resumo tambem identifica:

- speakers/participantes efetivos, com `role = "participant"`
- entidades mencionadas, com `role = "entity"`
- resumo estruturado usando referencias temporarias, como `p1` ou `e1`

O backend nunca envia IDs reais do banco para o modelo antes dessa chamada,
porque as linhas ainda nao existem. O modelo retorna refs temporarias; o backend
valida o envelope com Zod, salva `meeting_participants`, cria o mapa
`ref -> id`, reescreve `summary_structured` para UUIDs reais e salva o JSON final
em `meetings.summary_structured`.

Na leitura, `summary_structured` e combinado com `meeting_participants` para
renderizar nomes atuais. Renomear uma linha muda apenas `display_name`; o resumo
materializado nao precisa ser regravado.

## Data Model

Criar migration nova, seguindo a numeracao atual de `supabase/migrations`.

`meeting_participants`:

- `id uuid primary key default gen_random_uuid()`
- `meeting_id uuid not null references public.meetings(id) on delete cascade`
- `display_name text not null`
- `original_name text not null`
- `role text not null check (role in ('participant', 'entity'))`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indices:

- `idx_meeting_participants_meeting_id`
- `idx_meeting_participants_meeting_role`
- unique em `meeting_id, role, original_name` para idempotencia do processamento

Alterar `meetings`:

- `summary_structured jsonb`
- `summary_version integer not null default 1`

RLS:

- habilitar RLS em `meeting_participants`
- policies por ownership via join com `meetings.user_id = auth.uid()`
- grant normal para `authenticated`; service role continua operando pelo backend

## Gemini Envelope

`generateMeetingSummary` passa a retornar um envelope validado com esta ideia:

```json
{
  "participants": [
    {
      "ref": "p1",
      "display_name": "Ana",
      "original_name": "Speaker A",
      "role": "participant"
    },
    {
      "ref": "e1",
      "display_name": "Acme",
      "original_name": "Acme",
      "role": "entity"
    }
  ],
  "summary_whatsapp": "Resumo textual inicial",
  "summary_structured": {
    "version": 1,
    "title": "string",
    "sections": [
      {
        "title": "string",
        "content": "string",
        "participant_refs": ["p1", "e1"]
      }
    ],
    "action_items": [
      {
        "description": "Enviar proposta",
        "participant_ref": "p1",
        "due_date": null,
        "priority": "media"
      }
    ]
  }
}
```

Regras de prompt:

- participantes efetivos sao apenas speakers ou pessoas com fala atribuida
- entidades citadas nao entram como participantes efetivos
- entidades podem ser empresas, clientes, produtos, orgaos, sistemas ou pessoas
  mencionadas sem fala propria
- cada `participant_ref` ou `participant_refs[]` deve existir em `participants`
- se responsavel de uma tarefa nao foi definido, `participant_ref` deve ser null
- nao inventar nomes; quando o speaker nao for identificado, usar
  `original_name = "Speaker X"` e `display_name = "Participante X"`

## Structured Summary Final Shape

Antes de salvar, o backend troca refs temporarias por IDs reais:

```json
{
  "version": 1,
  "title": "string",
  "sections": [
    {
      "title": "string",
      "content": "string",
      "participant_ids": ["uuid-participant", "uuid-entity"]
    }
  ],
  "action_items": [
    {
      "description": "Enviar proposta",
      "participant_id": "uuid-participant",
      "due_date": null,
      "priority": "media"
    }
  ]
}
```

`participant_id` pode apontar para uma linha com `role = "participant"` ou
`role = "entity"` quando a referencia for contextual. Para responsavel de
`action_items`, o backend deve aceitar apenas `role = "participant"` ou `null`;
entidades citadas podem aparecer em `sections[].participant_ids`.

## Processing Flow

No `processMeeting`:

1. Transcrever audio e salvar `meetings.transcript`, como hoje.
2. Indexar chunks RAG, como hoje.
3. Chamar Gemini uma unica vez com transcricao e duracao.
4. Validar o envelope com Zod.
5. Salvar participantes e entidades em `meeting_participants`.
6. Reescrever `summary_structured` de refs para UUIDs.
7. Salvar em `meetings.summary_structured`, `summary_version`, `summary_whatsapp`,
   `summary_json` enquanto o legado ainda precisar dele, `title` e
   `prompt_version`.
8. Upsert de `tasks`, `decisions` e `open_items` continua idempotente.

Nao criar um step LLM separado para extracao de participantes. Pode haver um
step Inngest de persistencia/normalizacao, mas ele nao chama Gemini.

## Read Model

Criar helper backend em `src/lib/meetings/summary-renderer.ts` para montar a
visao de leitura:

- recebe `summary_structured` e `meeting_participants`
- resolve cada UUID para `display_name`
- retorna participantes efetivos filtrando `role = "participant"`
- retorna entidades filtrando `role = "entity"`
- renderiza texto de resumo usando nomes atuais
- preserva fallback para reunioes antigas usando `summary_whatsapp` e
  `summary_json`

`getMeetingWithRelationsForUser` deve selecionar `meeting_participants(*)`, e o
mapper de detalhe deve preferir a leitura hidratada quando `summary_structured`
existir.

## Edit API

Criar rota backend para renomear:

`PATCH /api/meetings/[id]/participants/[participantId]`

Request:

```json
{ "displayName": "Novo nome" }
```

Regras:

- usar `withAuth`
- chamar `requireOwnership` para a meeting antes da mutacao
- confirmar que `participantId` pertence a `meetingId`
- whitelist apenas `displayName`
- trim obrigatorio, tamanho maximo 80 caracteres
- atualizar somente `display_name` e `updated_at`
- nunca permitir editar `original_name`, `role` ou `meeting_id`

Opcionalmente criar `GET /api/meetings/[id]/participants` para o frontend listar
participantes e entidades sem depender do payload completo da reuniao.

## Error Handling

- Envelope Gemini invalido: falha o job com erro de provider validavel.
- Ref desconhecida no resumo estruturado: falha o job antes de salvar a reuniao
  como completed.
- Tentativa de renomear participante de outra reuniao: 403.
- `displayName` vazio ou longo demais: 400.
- Reuniao antiga sem `summary_structured`: leitura usa fallback legado.

## Testing

Cobrir com testes antes da implementacao:

- migration cria `meeting_participants`, indices, RLS e colunas novas em
  `meetings`
- `generateMeetingSummary` exige envelope com participantes e refs estruturadas
- Zod rejeita `action_items` com ref inexistente
- normalizador reescreve refs para IDs reais
- Inngest salva participantes antes de salvar `summary_structured`
- entidades nao aparecem na lista de participantes efetivos
- leitura renderiza o resumo com `display_name` atual
- PATCH usa ownership, whitelist e valida `displayName`
- PATCH nao altera `original_name`, `role` ou `meeting_id`
- fallback legado continua funcionando para reunioes antigas

## Files

- Create: `supabase/migrations/023_meeting_participants_summary_structured.sql`
- Modify: `src/types/database.ts`
- Modify: `src/lib/gemini.ts`
- Modify: `src/lib/gemini.test.ts`
- Create: `src/lib/meetings/summary-structured.ts`
- Create: `src/lib/meetings/summary-structured.test.ts`
- Create: `src/lib/meetings/summary-renderer.ts`
- Create: `src/lib/meetings/summary-renderer.test.ts`
- Modify: `src/lib/meetings/detail.ts`
- Modify: `src/inngest/process-meeting.ts`
- Modify: `src/inngest/process-meeting.test.ts`
- Create: `src/app/api/meetings/[id]/participants/[participantId]/route.ts`
- Create: `src/app/api/meetings/[id]/participants/[participantId]/route.test.ts`
- Optional create: `src/app/api/meetings/[id]/participants/route.ts`
- Optional create: `src/app/api/meetings/[id]/participants/route.test.ts`
