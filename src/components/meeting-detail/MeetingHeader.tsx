"use client";

import React from "react";
import { Calendar, MessageSquare, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PageHeader,
  StatusBadge,
  type PageHeaderBreadcrumb,
} from "@/components/ui/app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        <span className="hidden md:block">
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              aria-label="Mais opções"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onChat ? (
              <DropdownMenuItem onClick={onChat} className="cursor-pointer gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Chat com IA
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={onShare} className="cursor-pointer gap-2">
              <Share2 className="h-3.5 w-3.5" />
              Compartilhar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer gap-2">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </span>
      }
    />
  );
}
