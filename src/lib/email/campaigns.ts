import type { ReactElement } from "react";
import { InactivityEmail } from "@/emails/inactivity-email";
import { WelcomeEmail } from "@/emails/welcome-email";

export type EmailType = "welcome" | "inactivity_3d";

export interface WelcomeEmailInput {
  appUrl?: string;
  name: string | null;
}

export interface InactivityEmailInput extends WelcomeEmailInput {
  meetingsUsed: number;
  quotaLimit: number;
}

export interface EmailCampaign {
  emailType: EmailType;
  campaign: EmailType;
  subject: string;
  preview: string;
  ctaLabel: string;
  ctaUrl: string;
  element: ReactElement;
}

export interface InactivityEmailCampaign extends EmailCampaign {
  meetingsUsed: number;
  quotaLimit: number;
  quotaRemaining: number;
  quotaCopy: string;
  savedTimeCopy: string;
  upgradeCopy: string | null;
}

const DEFAULT_APP_URL = "http://localhost:3000";
const MINUTES_SAVED_PER_MEETING = 20;

export function estimateMeetingMinutesSaved(meetingsProcessed: number): number {
  return Math.max(0, meetingsProcessed) * MINUTES_SAVED_PER_MEETING;
}

function resolveAppUrl(appUrl?: string): string {
  return appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
}

function buildTrackedUrl(
  appUrl: string | undefined,
  path: string,
  campaign: EmailType
): string {
  const url = new URL(path, resolveAppUrl(appUrl));
  url.searchParams.set("utm_source", "resend");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("notura_email", campaign);
  return url.toString();
}

function formatSavedTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourLabel = hours === 1 ? "1 hora" : `${hours} horas`;

  if (remainingMinutes === 0) return hourLabel;
  return `${hourLabel} e ${remainingMinutes} minutos`;
}

function getDisplayName(name: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "tudo bem";
}

export function buildWelcomeEmailCampaign(
  input: WelcomeEmailInput
): EmailCampaign {
  const campaign = "welcome";
  const ctaUrl = buildTrackedUrl(input.appUrl, "/dashboard/recording", campaign);
  const props = {
    name: getDisplayName(input.name),
    ctaUrl,
  };

  return {
    emailType: campaign,
    campaign,
    subject: "Bem-vindo ao Notura",
    preview: "Processe sua primeira reunião e organize decisões, tarefas e próximos passos.",
    ctaLabel: "Processar primeira reunião",
    ctaUrl,
    element: WelcomeEmail(props),
  };
}

export function buildInactivityEmailCampaign(
  input: InactivityEmailInput
): InactivityEmailCampaign {
  const campaign = "inactivity_3d";
  const quotaRemaining = Math.max(0, input.quotaLimit - input.meetingsUsed);
  const quotaExhausted = quotaRemaining === 0;
  const ctaUrl = buildTrackedUrl(
    input.appUrl,
    quotaExhausted ? "/dashboard/settings" : "/dashboard/recording",
    campaign
  );
  const savedMinutes = estimateMeetingMinutesSaved(input.meetingsUsed);
  const savedTimeCopy =
    input.meetingsUsed === 0
      ? "Quando você processa reuniões no Notura, deixa de gastar tempo escrevendo atas manualmente e mantém decisões, tarefas e próximos passos organizados."
      : `Com ${input.meetingsUsed} reuniões processadas, você já economizou cerca de ${formatSavedTime(savedMinutes)} de trabalho manual escrevendo atas e organizando próximos passos.`;
  const quotaCopy = quotaExhausted
    ? "Sua cota atual acabou. Para continuar processando reuniões e manter esse ganho de produtividade, escolha um plano."
    : `Você ainda tem ${quotaRemaining} reuniões restantes na sua cota atual.`;
  const upgradeCopy = quotaExhausted
    ? "Para continuar usando o Notura nas suas reuniões e ampliar seu ganho de produtividade, escolha um plano."
    : null;
  const ctaLabel = quotaExhausted ? "Escolher um plano" : "Processar uma reunião";
  const props = {
    name: getDisplayName(input.name),
    ctaLabel,
    ctaUrl,
    quotaCopy,
    savedTimeCopy,
    upgradeCopy,
  };

  return {
    emailType: campaign,
    campaign,
    subject: "Faz alguns dias que você não acessa o Notura",
    preview: "Volte para transformar reuniões em decisões, tarefas e próximos passos.",
    ctaLabel,
    ctaUrl,
    meetingsUsed: input.meetingsUsed,
    quotaLimit: input.quotaLimit,
    quotaRemaining,
    quotaCopy,
    savedTimeCopy,
    upgradeCopy,
    element: InactivityEmail(props),
  };
}
