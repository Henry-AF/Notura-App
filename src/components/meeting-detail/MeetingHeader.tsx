"use client";

import React from "react";
import { Calendar, Share2, Pencil } from "lucide-react";
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
  onShare: () => void;
  onEdit: () => void;
}

export function MeetingHeader({
  breadcrumbs,
  clientName,
  date,
  status,
  participants,
  onShare,
  onEdit,
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
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onShare}>
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </div>
      }
    />
  );
}
