"use client";

import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardHeaderProps {
  userName: string;
  meetingsProcessedToday: number;
  onNewMeeting: () => void;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Bom dia", emoji: "👋" };
  if (hour >= 12 && hour < 18) return { text: "Boa tarde", emoji: "☀️" };
  return { text: "Boa noite", emoji: "🌙" };
}

export function DashboardHeader({
  userName,
  meetingsProcessedToday,
  onNewMeeting,
}: DashboardHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
          {greeting.text}, {userName} {greeting.emoji}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sua inteligência fluida processou{" "}
          <span className="font-bold text-foreground">
            {meetingsProcessedToday} reuniões
          </span>{" "}
          hoje.
        </p>
      </div>

      <Button
        type="button"
        onClick={onNewMeeting}
        size="lg"
        className="mt-1 rounded-full px-6"
      >
        <Plus className="h-[18px] w-[18px]" />
        Nova reunião
      </Button>
    </div>
  );
}
