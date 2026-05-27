"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/app";
import GradientText from "@/components/ui/gradient-text";
import SplitText from "@/components/ui/split-text";

export interface DashboardHeaderProps {
  userName: string;
  meetingsProcessedToday: number;
  newMeetingOnboardingId?: string;
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
  newMeetingOnboardingId,
}: DashboardHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <PageHeader
      breadcrumbs={[{ label: "Dashboard" }]}
      title={
        <SplitText
          tag="span"
          splitType="words"
          delay={80}
          duration={0.6}
          ease="power3.out"
          from={{ opacity: 0, y: 20 }}
          to={{ opacity: 1, y: 0 }}
          textAlign="left"
          className="align-top"
        >
          <>
            {`${greeting.text}, `}
            <GradientText
              colors={["#7C3AED", "#A855F7", "#C084FC", "#A855F7", "#7C3AED"]}
              animationSpeed={4}
              showBorder={false}
            >
              {userName}
            </GradientText>{" "}
            {greeting.emoji}
          </>
        </SplitText>
      }
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
          <Link href="/dashboard/recording" data-onboarding={newMeetingOnboardingId}>
            <Plus className="h-[18px] w-[18px]" />
            Nova reunião
          </Link>
        </Button>
      }
    />
  );
}

