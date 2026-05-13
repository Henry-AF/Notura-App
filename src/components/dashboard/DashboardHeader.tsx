"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/app";

export interface DashboardHeaderProps {
  userName: string;
  meetingsProcessedToday: number;
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
        <Button asChild size="lg" className="rounded-full px-6">
          <Link href="/dashboard/recording">
            <Plus className="h-[18px] w-[18px]" />
            Nova reunião
          </Link>
        </Button>
      }
    />
  );
}

