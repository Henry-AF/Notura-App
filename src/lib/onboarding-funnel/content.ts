import type {
  GoalId,
  MeetingFrequencyId,
  OnboardingContent,
  OnboardingState,
  Option,
  ProblemId,
  ProfileId,
} from "./types";

/**
 * All copy of the acquisition funnel lives here. Screens only render what this
 * file returns, so new variations never require touching the UI.
 */

export const PROBLEM_OPTIONS: Option<ProblemId>[] = [
  { id: "minutes", label: "Preciso fazer a ata manualmente" },
  { id: "tasks", label: "As tarefas ficam perdidas" },
  { id: "decisions", label: "Esqueço o que foi decidido" },
  { id: "follow-up", label: "Preciso cobrar as pessoas depois" },
  { id: "memory", label: "Tenho dificuldade para lembrar tudo" },
  { id: "all", label: "Um pouco de tudo" },
];

export const PROFILE_OPTIONS: Option<ProfileId>[] = [
  { id: "manager", label: "Gestor / líder" },
  { id: "sales", label: "Comercial / vendas" },
  { id: "operations", label: "Operações" },
  { id: "product", label: "Produto / tecnologia" },
  { id: "projects", label: "Projetos" },
  { id: "admin", label: "Administrativo" },
  { id: "other", label: "Outro" },
];

export const FREQUENCY_OPTIONS: Option<MeetingFrequencyId>[] = [
  { id: "1-3", label: "1–3" },
  { id: "4-7", label: "4–7" },
  { id: "8-15", label: "8–15" },
  { id: "15+", label: "15+" },
];

export const GOAL_OPTIONS: Option<GoalId>[] = [
  { id: "minutes", label: "Criar atas automaticamente" },
  { id: "summary", label: "Resumir reuniões" },
  { id: "decisions", label: "Identificar decisões" },
  { id: "tasks", label: "Criar tarefas" },
  { id: "owners", label: "Identificar responsáveis" },
  { id: "deadlines", label: "Identificar prazos" },
  { id: "search", label: "Encontrar informações depois" },
  { id: "ask", label: "Perguntar sobre reuniões anteriores" },
];

export const FREQUENCY_CONTEXT: Record<MeetingFrequencyId, string> = {
  "1-3": "Poucas reuniões por semana — mas cada uma gera combinados que precisam sair da conversa.",
  "4-7": "Você participa de várias reuniões toda semana.",
  "8-15": "Você participa de muitas reuniões toda semana.",
  "15+": "Sua semana é praticamente feita de reuniões.",
};

export const FREQUENCY_CONTEXT_FOOTER =
  "O problema não é participar delas. É conseguir lembrar e acompanhar tudo depois.";

interface PromiseContent {
  title: string;
  description: string;
}

const PROMISES: Record<ProblemId, PromiseContent> = {
  tasks: {
    title: "Nunca mais procure quem ficou responsável por uma tarefa.",
    description:
      "O Notura identifica automaticamente tarefas, responsáveis e prazos durante suas reuniões.",
  },
  minutes: {
    title: "Pare de gastar seu tempo escrevendo atas.",
    description: "O Notura transforma suas reuniões em atas organizadas automaticamente.",
  },
  decisions: {
    title: "Não deixe decisões importantes se perderem na conversa.",
    description: "O Notura identifica e organiza as decisões tomadas durante suas reuniões.",
  },
  "follow-up": {
    title: "Pare de cobrar as pessoas por algo que já foi combinado.",
    description:
      "Cada combinado sai da reunião com responsável e prazo definidos, para você acompanhar sem perguntar de novo.",
  },
  memory: {
    title: "Você não precisa lembrar de tudo. O Notura lembra.",
    description:
      "Suas reuniões ficam organizadas e fáceis de consultar sempre que você precisar de um detalhe.",
  },
  all: {
    title: "Tudo o que foi dito na reunião, organizado para você.",
    description:
      "Resumo, decisões, tarefas, responsáveis e prazos — sem você precisar anotar nada.",
  },
};

const PROFILE_LINES: Record<ProfileId, string> = {
  manager: "Para quem lidera times, cada reunião gera combinados que precisam ser acompanhados.",
  sales: "Para quem vende, o que o cliente combinou na reunião precisa virar próximo passo.",
  operations: "Para quem cuida de operações, cada alinhamento precisa virar uma ação com dono.",
  product: "Para quem trabalha com produto e tecnologia, decisões e pendências não podem se perder.",
  projects: "Para quem gerencia projetos, prazos e responsáveis precisam estar sempre claros.",
  admin: "Para quem cuida do administrativo, registrar o que foi tratado deixa de ser trabalho manual.",
  other: "Para o seu dia a dia, o que foi combinado na reunião fica registrado e organizado.",
};

export interface CampaignContent {
  eyebrow: string;
  subtitle: string;
  /** Used for the promise when the user answers "Um pouco de tudo" or skips the problem step. */
  focusProblem: ProblemId;
}

export const CAMPAIGNS: Record<string, CampaignContent> = {
  "meeting-minutes": {
    eyebrow: "Atas automáticas",
    subtitle: "Vamos entender como você registra suas reuniões hoje e mostrar a ata pronta, sem digitar nada.",
    focusProblem: "minutes",
  },
  tasks: {
    eyebrow: "Tarefas, responsáveis e prazos",
    subtitle: "Vamos entender onde suas tarefas se perdem e mostrar como elas saem da reunião já organizadas.",
    focusProblem: "tasks",
  },
  sales: {
    eyebrow: "Para times comerciais",
    subtitle: "Vamos entender o que se perde depois das reuniões com clientes e como o Notura resolve isso.",
    focusProblem: "follow-up",
  },
  manager: {
    eyebrow: "Para gestores e líderes",
    subtitle: "Vamos entender como você acompanha o que foi combinado e mostrar como ficar sem cobrar de novo.",
    focusProblem: "follow-up",
  },
};

const DEFAULT_ENTRY: OnboardingContent = {
  title: "O que costuma acontecer depois das suas reuniões?",
  subtitle: "Vamos entender seu principal desafio e mostrar como o Notura pode ajudar.",
};

export const BRAND_PROMISE = "O Notura lembra de tudo. Você só precisa aparecer.";

export interface Objection {
  id: string;
  quote: string;
  answer: string;
  detail: string;
}

export const OBJECTIONS: Objection[] = [
  {
    id: "no-notes",
    quote: "Eu não quero ficar anotando tudo.",
    answer: "Você não precisa.",
    detail:
      "Grave ou envie sua reunião e o Notura organiza os principais pontos automaticamente.",
  },
  {
    id: "setup",
    quote: "Vou precisar configurar um monte de coisas?",
    answer: "Não.",
    detail:
      "Você pode começar com uma reunião e ver o resultado antes de configurar o restante.",
  },
  {
    id: "find-later",
    quote: "E se eu quiser encontrar essa informação depois?",
    answer: "Está tudo no lugar.",
    detail:
      "Suas reuniões ficam organizadas para você consultar decisões, tarefas e informações posteriormente.",
  },
];

export function getCampaignContent(campaign: string | undefined): CampaignContent | null {
  return campaign && campaign in CAMPAIGNS ? CAMPAIGNS[campaign] : null;
}

export function getEntryContent(campaign: string | undefined): OnboardingContent {
  const campaignContent = getCampaignContent(campaign);
  if (!campaignContent) return DEFAULT_ENTRY;
  return {
    ...DEFAULT_ENTRY,
    eyebrow: campaignContent.eyebrow,
    subtitle: campaignContent.subtitle,
  };
}

export interface ResolvedPromise {
  title: string;
  description: string;
  profileLine: string | null;
  goals: string[];
}

function resolvePromiseProblem(state: OnboardingState): ProblemId {
  if (state.problem && state.problem !== "all") return state.problem;
  return getCampaignContent(state.campaign)?.focusProblem ?? "all";
}

/** Personalizes the promise screen from problem + profile + goals (+ campaign fallback). */
export function resolvePromise(state: OnboardingState): ResolvedPromise {
  const promise = PROMISES[resolvePromiseProblem(state)];
  const goals = GOAL_OPTIONS.filter((option) => state.goals.includes(option.id)).map(
    (option) => option.label
  );
  return {
    title: promise.title,
    description: promise.description,
    profileLine: state.profile ? PROFILE_LINES[state.profile] : null,
    goals,
  };
}
