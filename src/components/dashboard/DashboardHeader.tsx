"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Mic, Plus, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/app";
import { cn } from "@/lib/utils";

export interface DashboardHeaderProps {
  userName: string;
  meetingsProcessedToday: number;
  onNewMeeting: () => void;
  onUpload: () => void;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Bom dia", emoji: "👋" };
  if (hour >= 12 && hour < 18) return { text: "Boa tarde", emoji: "☀️" };
  return { text: "Boa noite", emoji: "🌙" };
}

function NewMeetingDropdown({
  onNewMeeting,
  onUpload,
}: {
  onNewMeeting: () => void;
  onUpload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        size="lg"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "rounded-full px-6 transition-all",
          open && "ring-2 ring-primary/40"
        )}
      >
        <Plus className="h-[18px] w-[18px]" />
        Nova reunião
        <ChevronDown
          className={cn(
            "ml-1 h-4 w-4 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </Button>

      {open && (
        <div
          role="menu"
          className="animate-slide-down absolute right-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            aria-label="Nova reunião — Gravar ou iniciar reunião"
            onClick={() => {
              close();
              onNewMeeting();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Mic className="h-3.5 w-3.5 text-[#6C5CE7]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Nova reunião</p>
              <p className="text-xs text-muted-foreground">
                Gravar ou iniciar reunião
              </p>
            </div>
          </button>

          <div className="mx-3 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            aria-label="Upload de arquivo — Enviar áudio ou vídeo"
            onClick={() => {
              close();
              onUpload();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/50"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <UploadCloud className="h-3.5 w-3.5 text-[#4ECB71]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Upload de arquivo</p>
              <p className="text-xs text-muted-foreground">
                Enviar áudio ou vídeo
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export function DashboardHeader({
  userName,
  meetingsProcessedToday,
  onNewMeeting,
  onUpload,
}: DashboardHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <PageHeader
      breadcrumbs={[{ label: "Dashboard" }]}
      title={`${greeting.text}, ${userName} ${greeting.emoji}`}
      description={
        <>
          Sua inteligência fluida processou{" "}
          <span className="font-bold text-foreground">
            {meetingsProcessedToday} reuniões
          </span>{" "}
          hoje.
        </>
      }
      descriptionClassName="max-w-none"
      actions={
        <NewMeetingDropdown onNewMeeting={onNewMeeting} onUpload={onUpload} />
      }
    />
  );
}
