import * as React from "react";
import { Badge } from "@/components/ui/badge";

type StatusVariant = "completed" | "processing" | "failed" | "scheduled" | "pending";

const STATUS_LABELS: Record<StatusVariant, string> = {
  completed: "Concluido",
  processing: "Processando",
  failed: "Falhou",
  scheduled: "Agendado",
  pending: "Pendente",
};

function statusToVariant(status: StatusVariant): "completed" | "processing" | "failed" | "default" {
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  return "default";
}

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge variant={statusToVariant(status)} className={className}>
      {label ?? STATUS_LABELS[status]}
    </Badge>
  );
}
