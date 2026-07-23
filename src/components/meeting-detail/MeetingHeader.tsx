"use client";

import React, { useState } from "react";
import {
  Calendar,
  ChevronDown,
  Download,
  MessageSquare,
  RefreshCw,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PageHeader,
  StatusBadge,
  type PageHeaderBreadcrumb,
} from "@/components/ui/app";

export interface MeetingExportTemplateOption {
  id: string;
  name: string;
}

function ExportButton({
  templates,
  isExporting,
  onExport,
}: {
  templates: MeetingExportTemplateOption[];
  isExporting: boolean;
  onExport: (templateId: string) => void;
}) {
  const buttonClassName =
    "w-full border-0 bg-[#5E4CEB] text-white shadow-[0_10px_24px_rgba(94,76,235,0.28)] transition-all duration-200 hover:brightness-105 active:scale-[0.96] sm:w-auto";

  if (templates.length <= 1) {
    return (
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={() => onExport(templates[0] ? templates[0].id : "default")}
        disabled={isExporting}
        className={buttonClassName}
      >
        <Download className="size-4" />
        {isExporting ? "Exportando..." : "Exportar ata"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={isExporting}
          className={buttonClassName}
        >
          <Download className="size-4" />
          {isExporting ? "Exportando..." : "Exportar ata"}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onSelect={() => onExport(template.id)}
          >
            {template.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
          className="-ml-2 size-7 border-2 border-background first:ml-0"
        >
          <AvatarFallback name={participant.name} className="text-[10px] font-semibold" />
        </Avatar>
      ))}
      {extra > 0 ? (
        <div
          className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground"
          aria-label={`${extra} participantes adicionais`}
          title={`${participants.length} participantes no total`}
        >
          +{extra}
        </div>
      ) : null}
    </div>
  );
}

function TitleWithEdit({
  name,
  onSave,
}: {
  name: string;
  onSave: (newName: string) => Promise<void>;
}) {
  const [editingName, setEditingName] = useState<string | null>(null);

  async function handleSave() {
    if (editingName === null) return;
    const trimmed = editingName.trim();
    setEditingName(null);
    if (trimmed && trimmed !== name) {
      await onSave(trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { void handleSave(); }
    if (e.key === "Escape") { setEditingName(null); }
  }

  if (editingName !== null) {
    return (
      <input
        autoFocus
        type="text"
        value={editingName}
        onChange={(e) => setEditingName(e.target.value)}
        onBlur={() => { void handleSave(); }}
        onKeyDown={handleKeyDown}
        aria-label="Nome da reunião"
        className="w-full border-0 border-b-2 border-primary bg-transparent p-0 font-display text-3xl font-extrabold text-foreground outline-none"
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {name}
      <button
        type="button"
        aria-label="Editar nome"
        title="Editar nome"
        onClick={() => setEditingName(name)}
        className="inline-flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Pencil className="size-4" />
      </button>
    </span>
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
  onCancelProcessing?: () => void;
  isCancelingProcessing?: boolean;
  onRenameTitle: (name: string) => Promise<void>;
  onDelete: () => void;
  onExport?: (templateId: string) => void;
  isExporting?: boolean;
  exportTemplates?: MeetingExportTemplateOption[];
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
  onCancelProcessing,
  isCancelingProcessing = false,
  onRenameTitle,
  onDelete,
  onExport,
  isExporting = false,
  exportTemplates = [],
}: MeetingHeaderProps) {
  return (
    <PageHeader
      breadcrumbs={breadcrumbs}
      title={<TitleWithEdit name={clientName} onSave={onRenameTitle} />}
      description={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="size-4" />
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
              <RefreshCw className={`size-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Reprocessando..." : "Reprocessar"}
            </Button>
          ) : null}
          {onCancelProcessing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelProcessing}
              disabled={isCancelingProcessing}
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 sm:w-auto"
            >
              <XCircle className="size-4" />
              {isCancelingProcessing ? "Cancelando..." : "Cancelar processamento"}
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
              <MessageSquare className="size-4" />
              Perguntar para a IA
              <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white/90">
                BETA
              </span>
            </Button>
          ) : null}
          {onExport ? (
            <ExportButton
              templates={exportTemplates}
              isExporting={isExporting}
              onExport={onExport}
            />
          ) : null}
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onDelete}
            aria-label="Excluir reunião"
            title="Excluir reunião"
            className="w-9 px-0 sm:w-9"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      }
    />
  );
}
