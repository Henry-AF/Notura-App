import type { OnboardingStep } from "./OnboardingTour";

export const dashboardSteps: OnboardingStep[] = [
  {
    target: null,
    title: "Bem-vindo ao Notura 👋",
    description:
      "Em poucos passos você vai entender como transformar suas reuniões em inteligência. Vamos começar?",
  },
  {
    target: "btn-presencial",
    title: "Reunião Presencial",
    description:
      "Use esta opção quando todos estão no mesmo ambiente. O Notura capta o áudio pelo microfone do seu dispositivo em tempo real.",
  },
  {
    target: "btn-remota",
    title: "Reunião Remota",
    description:
      "Para calls no Google Meet, Zoom ou Teams. Você seleciona a aba do navegador para capturar o áudio. Disponível apenas no computador via navegador.",
  },
  {
    target: "btn-upload",
    title: "Já tem uma gravação?",
    description:
      "Faça upload de um arquivo de áudio ou vídeo e o Notura gera a transcrição e o resumo automaticamente.",
  },
  {
    target: "reunioes-recentes",
    title: "Seu histórico inteligente",
    description:
      "Aqui ficam todas as reuniões processadas. Acesse transcrições, resumos e insights de cada uma.",
  },
  {
    target: "btn-nova-reuniao",
    title: "Tudo começa aqui",
    description:
      "Este é seu atalho principal. Sempre que quiser iniciar ou processar uma nova reunião, clique aqui.",
  },
];

export const recordingSteps: OnboardingStep[] = [
  {
    target: "campo-grupo",
    title: "O que é um Grupo?",
    description:
      "Grupos organizam suas reuniões por cliente, projeto ou time. Crie um novo ou selecione um existente — o resumo da reunião ficará associado a ele.",
    waitForElement: false,
  },
  {
    target: "campo-numero",
    title: "Receba o resumo no WhatsApp",
    description:
      "Após o processamento, o Notura envia o resumo direto para este número. Pode ser o seu ou o de qualquer participante da reunião.",
    waitForElement: true,
    allowInteraction: true,
  },
];
