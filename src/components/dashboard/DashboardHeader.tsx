"use client";

import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/app";

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
        <Button
          type="button"
          onClick={onNewMeeting}
          size="lg"
          className="rounded-full px-6"
        >
          <Plus className="h-[18px] w-[18px]" />
          Nova reunião
        </Button>
      }
    />
  );
}
