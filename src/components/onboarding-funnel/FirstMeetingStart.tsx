"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderUp, Mic, Sparkles, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trackFunnelEvent } from "@/lib/onboarding-funnel/analytics";
import { loadFunnelState } from "@/lib/onboarding-funnel/storage";
import type { OnboardingState } from "@/lib/onboarding-funnel/types";

interface StartOption {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  event: "first_meeting_started" | null;
}

const START_OPTIONS: StartOption[] = [
  {
    href: "/dashboard/recording",
    icon: Mic,
    title: "Gravar reunião",
    description: "Começar uma reunião agora.",
    event: "first_meeting_started",
  },
  {
    href: "/dashboard/recording?mode=upload",
    icon: FolderUp,
    title: "Enviar gravação",
    description: "Tenho uma reunião gravada.",
    event: "first_meeting_started",
  },
  {
    href: "/start/demo",
    icon: Sparkles,
    title: "Ver novamente a demonstração",
    description: "Quero rever como funciona.",
    event: null,
  },
];

interface FirstMeetingStartProps {
  /** Only shown while the user has no meetings yet. */
  hasMeetings: boolean;
}

/** Contextual entry for users who came through the acquisition funnel and have not recorded yet. */
export function FirstMeetingStart({ hasMeetings }: FirstMeetingStartProps) {
  const [funnel, setFunnel] = useState<OnboardingState | null>(null);

  useEffect(() => {
    const stored = loadFunnelState();
    setFunnel(stored?.completed ? stored : null);
  }, []);

  if (!funnel || hasMeetings) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <h2 className="font-display text-xl font-bold text-foreground">
          Vamos começar sua primeira reunião.
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {START_OPTIONS.map((option) => (
            <StartOptionLink key={option.href} option={option} funnel={funnel} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StartOptionLink({ option, funnel }: { option: StartOption; funnel: OnboardingState }) {
  const Icon = option.icon;

  return (
    <Link
      href={option.href}
      onClick={() => {
        if (option.event) trackFunnelEvent(option.event, funnel, { source: option.title });
      }}
      className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60"
    >
      <Icon className="size-5 text-primary" />
      <span className="text-sm font-semibold text-foreground">{option.title}</span>
      <span className="text-xs text-muted-foreground">{option.description}</span>
    </Link>
  );
}
