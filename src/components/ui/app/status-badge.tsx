import * as React from "react";
import { Check, Clock, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "add" | "confirmed" | "waiting" | "accepted" | "rejected";

const STATUS_TOKENS: Record<StatusTone, { badge: string; text: string; iconBg: string; icon: string }> = {
  add: {
    badge: "#EFEFEF",
    text: "#333333",
    iconBg: "#CCCCCC",
    icon: "#FFFFFF",
  },
  confirmed: {
    badge: "rgb(var(--primary))",
    text: "#FFFFFF",
    iconBg: "#FFFFFF",
    icon: "rgb(var(--primary))",
  },
  waiting: {
    badge: "#FFF0E6",
    text: "#E07B39",
    iconBg: "#E07B39",
    icon: "#FFFFFF",
  },
  accepted: {
    badge: "#E8F8F0",
    text: "#27AE60",
    iconBg: "#27AE60",
    icon: "#FFFFFF",
  },
  rejected: {
    badge: "#FEE8E8",
    text: "#E53935",
    iconBg: "#E53935",
    icon: "#FFFFFF",
  },
};

const STATUS_ICONS: Record<StatusTone, React.ElementType> = {
  add: Plus,
  confirmed: Check,
  waiting: Clock,
  accepted: Check,
  rejected: X,
};

const STATUS_LABELS: Record<StatusTone, string> = {
  add: "Adicionar",
  confirmed: "Confirmado",
  waiting: "Aguardando",
  accepted: "Concluido",
  rejected: "Cancelado",
};

const STATUS_ALIASES: Record<string, { tone: StatusTone; label: string }> = {
  // Accepted
  completed: { tone: "accepted", label: "Concluido" },
  concluido: { tone: "accepted", label: "Concluido" },
  finalizado: { tone: "accepted", label: "Finalizado" },
  approved: { tone: "accepted", label: "Aprovado" },
  aprovado: { tone: "accepted", label: "Aprovado" },
  accepted: { tone: "accepted", label: "Aceito" },
  aceito: { tone: "accepted", label: "Aceito" },
  respondido: { tone: "accepted", label: "Respondido" },
  done: { tone: "accepted", label: "Concluido" },
  // Confirmed / In-progress
  confirmed: { tone: "confirmed", label: "Confirmado" },
  confirmado: { tone: "confirmed", label: "Confirmado" },
  em_andamento: { tone: "confirmed", label: "Em andamento" },
  processing: { tone: "confirmed", label: "Em andamento" },
  in_progress: { tone: "confirmed", label: "Em andamento" },
  active: { tone: "confirmed", label: "Em andamento" },
  // Waiting
  pending: { tone: "waiting", label: "Pendente" },
  pendente: { tone: "waiting", label: "Pendente" },
  scheduled: { tone: "waiting", label: "Agendado" },
  agendado: { tone: "waiting", label: "Agendado" },
  waiting: { tone: "waiting", label: "Aguardando" },
  aguardando: { tone: "waiting", label: "Aguardando" },
  sem_confirmacao: { tone: "waiting", label: "Sem confirmacao" },
  em_breve: { tone: "waiting", label: "Em breve" },
  // Rejected
  failed: { tone: "rejected", label: "Falhou" },
  falhou: { tone: "rejected", label: "Falhou" },
  cancelled: { tone: "rejected", label: "Cancelado" },
  canceled: { tone: "rejected", label: "Cancelado" },
  cancelado: { tone: "rejected", label: "Cancelado" },
  declined: { tone: "rejected", label: "Recusado" },
  recusado: { tone: "rejected", label: "Recusado" },
  rejected: { tone: "rejected", label: "Rejeitado" },
  rejeitado: { tone: "rejected", label: "Rejeitado" },
  error: { tone: "rejected", label: "Erro" },
  erro: { tone: "rejected", label: "Erro" },
  inactive: { tone: "rejected", label: "Inativo" },
};

function normalizeStatusKey(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveStatus(status: string | null | undefined): { tone: StatusTone; label: string } {
  if (!status || !status.trim()) {
    return { tone: "add", label: STATUS_LABELS.add };
  }

  const key = normalizeStatusKey(status);
  const mapped = STATUS_ALIASES[key];
  if (mapped) {
    return mapped;
  }

  return { tone: "waiting", label: STATUS_LABELS.waiting };
}

interface StatusBadgeProps {
  status?: string | null;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const resolved = resolveStatus(status);
  const tokens = STATUS_TOKENS[resolved.tone];
  const Icon = STATUS_ICONS[resolved.tone];
  const finalLabel = label ?? resolved.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all",
        className
      )}
      style={{ background: tokens.badge, color: tokens.text, transition: "all 0.2s ease" }}
      aria-label={`Status: ${finalLabel}`}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{ background: tokens.iconBg, color: tokens.icon }}
        aria-hidden="true"
      >
        <Icon className="h-[11px] w-[11px]" />
      </span>
      {finalLabel}
    </span>
  );
}
