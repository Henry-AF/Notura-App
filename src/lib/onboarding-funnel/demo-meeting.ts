/**
 * MOCK — official demo meeting used as the Aha Moment.
 *
 * This is local, static data (no backend). It is isolated here on purpose: when a
 * real demo meeting exists in the API, replace the source of `DEMO_MEETING` and the
 * UI keeps working because it only depends on the `DemoMeeting` shape.
 */

export interface DemoParticipant {
  name: string;
  role: string;
}

export interface DemoTask {
  owner: string;
  title: string;
  dueLabel: string;
}

export interface DemoTranscriptLine {
  speaker: string;
  text: string;
}

export interface DemoMeeting {
  id: string;
  isDemo: true;
  title: string;
  dateLabel: string;
  theme: string;
  participants: DemoParticipant[];
  transcript: DemoTranscriptLine[];
  summary: string;
  decisions: string[];
  tasks: DemoTask[];
  problems: string[];
  nextSteps: string[];
}

export const DEMO_MEETING: DemoMeeting = {
  id: "demo-project-atlas",
  isDemo: true,
  title: "Reunião de alinhamento — Projeto Atlas",
  dateLabel: "Reunião de demonstração",
  theme: "Alinhamento semanal do Projeto Atlas",
  participants: [
    { name: "Henry", role: "Responsável pelo projeto" },
    { name: "Ana", role: "Produto" },
    { name: "Carlos", role: "Desenvolvimento" },
    { name: "Marina", role: "Comercial" },
  ],
  transcript: [
    { speaker: "Henry", text: "Estamos perto da entrega. Vamos fechar a primeira versão na sexta, certo?" },
    { speaker: "Carlos", text: "Dá, mas o fluxo de autenticação ainda tem um erro. Eu corrijo até sexta." },
    { speaker: "Ana", text: "Eu valido as telas finais até quarta para não travar o Carlos." },
    { speaker: "Marina", text: "Os clientes mandaram bastante feedback. Envio tudo até quinta." },
  ],
  summary:
    "O Projeto Atlas está próximo da primeira entrega, prevista para sexta-feira. O escopo atual foi mantido e uma funcionalidade secundária ficou para a próxima versão. Há uma integração com inconsistências e o prazo está apertado, por isso cada responsável assumiu uma entrega antes da data final.",
  decisions: [
    "A primeira versão será entregue na sexta-feira.",
    "O escopo atual será mantido.",
    "Uma funcionalidade secundária ficará para a próxima versão.",
  ],
  tasks: [
    { owner: "Carlos", title: "Corrigir autenticação", dueLabel: "Até sexta-feira" },
    { owner: "Ana", title: "Validar telas", dueLabel: "Até quarta-feira" },
    { owner: "Marina", title: "Enviar feedback dos clientes", dueLabel: "Até quinta-feira" },
  ],
  problems: [
    "Uma integração está apresentando inconsistências.",
    "O prazo está apertado.",
  ],
  nextSteps: [
    "Validar integração.",
    "Finalizar telas.",
    "Consolidar feedback dos clientes.",
    "Realizar nova reunião na próxima semana.",
  ],
};

export const DEMO_PROCESSING_STEPS = [
  "Ouvindo a reunião",
  "Identificando decisões",
  "Organizando tarefas, responsáveis e prazos",
  "Montando o resumo",
] as const;
