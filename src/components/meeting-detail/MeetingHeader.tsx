"use client";

import React from "react";
import { Calendar, MessageSquare, RefreshCw, Share2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PageHeader,
  StatusBadge,
  type PageHeaderBreadcrumb,
} from "@/components/ui/app";

function statusLabel(
  status: MeetingHeaderProps["status"]
): "completed" | "processing" | "failed" | "scheduled" | "pending" {
  if (status === "completed") return "completed";
  if (status === "processing") return "processing";
  if (status === "failed") return "failed";
  if (status === "scheduled") return "scheduled";
  return "pending";
}

function ParticipantAvatars({
  participants,
  maxVisible = 4,
}: {
  participants: Array<{ name: string; avatarUrl?: string }>;
  maxVisible?: number;
}) {
  const visible = participants.slice(0, maxVisible);
  const extra = participants.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((participant, index) => (
        <Avatar
          key={`${participant.name}-${index}`}
          className="-ml-2 h-7 w-7 border-2 border-background first:ml-0"
        >
          <AvatarFallback name={participant.name} className="text-[10px] font-semibold" />
        </Avatar>
      ))}
      {extra > 0 ? (
        <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
          +{extra}
        </div>
      ) : null}
    </div>
  );
}

export interface MeetingHeaderProps {
  breadcrumbs: PageHeaderBreadcrumb[];
  clientName: string;
  date: string;
  status: "completed" | "processing" | "failed" | "scheduled";
  participants: Array<{ name: string; avatarUrl?: string }>;
  onChat?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MeetingHeader({
  breadcrumbs,
  clientName,
  date,
  status,
  participants,
  onChat,
  onRetry,
  isRetrying = false,
  onShare,
  onEdit,
  onDelete,
}: MeetingHeaderProps) {
  return (
    <PageHeader
      breadcrumbs={breadcrumbs}
      title={clientName}
      description={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {date}
          </span>
          <StatusBadge status={statusLabel(status)} />
          <ParticipantAvatars participants={participants} />
        </div>
      }
      descriptionClassName="max-w-none"
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950 sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Reprocessando..." : "Reprocessar"}
            </Button>
          ) : null}
          {onChat ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onChat}
              className="w-full border-0 bg-[linear-gradient(135deg,rgba(94,76,235,0.92)_0%,rgba(59,130,246,0.82)_100%)] text-white shadow-[0_10px_24px_rgba(94,76,235,0.28),0_4px_12px_rgba(59,130,246,0.18)] transition-all duration-200 hover:scale-[0.99] hover:brightness-105 sm:w-auto"
            >
              <MessageSquare className="h-4 w-4" />
              Perguntar para a IA
              <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white/90">
                BETA
              </span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onShare}
            className="w-full sm:w-auto"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="w-full sm:w-auto"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onDelete}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      }
    />
  );
}
