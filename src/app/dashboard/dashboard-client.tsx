"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BannerCarousel,
  DashboardHeader,
  QuickActionCard,
  RecentMeetingsTable,
  InsightCard,
  UpgradeCard,
} from "@/components/dashboard";
import type { QuickActionCardProps, Meeting } from "@/components/dashboard";
import { useToast } from "@/components/upload/Toast";
import { PageShell } from "@/components/ui/app";
import { getPlanTitle } from "@/lib/plans";
import type { DashboardOverviewData } from "./dashboard-types";

// ─── Quick action cards ───────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickActionCardProps[] = [
  {
    label: "Gravar Reunião Presencial",
    href: "/dashboard/recording",
    colors: { color1: "#6851FF", color2: "#9B87FF", color3: "#1A0F4E" },
  },
  {
    label: "Gravar Reunião Remota",
    href: "/dashboard/recording?mode=remote",
    colors: { color1: "#059669", color2: "#34D399", color3: "#022C22" },
  },
  {
    label: "Processar Reunião Gravada",
    href: "/dashboard/new",
    colors: { color1: "#F59E0B", color2: "#FCD34D", color3: "#451A03" },
  },
];

// ─── Client ───────────────────────────────────────────────────────────────────

export interface DashboardClientProps {
  initialOverview: DashboardOverviewData;
}

export function DashboardClient({ initialOverview }: DashboardClientProps) {
  const router = useRouter();
  const { show } = useToast();

  const [meetings, setMeetings] = useState<Meeting[]>(initialOverview.meetings);

  const handleRetry = useCallback(
    async (id: string) => {
      show("Reprocessando...", "warning");
      try {
        const response = await fetch(`/api/meetings/${id}/retry`, { method: "POST" });
        if (!response.ok) throw new Error();
        setMeetings((previous) =>
          previous.map((meeting) =>
            meeting.id === id ? { ...meeting, status: "processing" as const } : meeting
          )
        );
        show("Reunião enviada para reprocessamento.", "success");
      } catch {
        show("Erro ao reprocessar. Tente novamente.", "error");
      }
    },
    [show]
  );

  useEffect(() => {
    router.prefetch("/dashboard/recording");
    router.prefetch("/dashboard/new");
    router.prefetch("/dashboard/meetings");
  }, [router]);

  return (
    <PageShell>
      <div className="animate-fade-in">
        <DashboardHeader
          userName={initialOverview.userName}
          meetingsProcessedToday={initialOverview.todayCount}
          onNewMeeting={() => router.push("/dashboard/recording")}
          onUpload={() => router.push("/dashboard/new")}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <div className="animate-fade-in [animation-delay:40ms]">
            <BannerCarousel />
          </div>

          <div className="mt-6">
            {/* Quick action cards — same width column as the meetings table */}
            <div className="grid grid-cols-3 gap-3 animate-fade-in [animation-delay:55ms]">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionCard key={action.href} {...action} />
              ))}
            </div>

            <div className="mt-4 animate-fade-in [animation-delay:120ms]">
              <RecentMeetingsTable
                meetings={meetings}
                onViewAll={() => router.push("/dashboard/meetings")}
                onRetry={handleRetry}
                onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}
                onRowClick={(id) => router.push(`/dashboard/meetings/${id}`)}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-4">
          <div className="animate-fade-in [animation-delay:80ms]">
            <InsightCard
              title="Dicas de produtividade"
              body="Agende suas reuniões mais importantes pela manhã — você terá mais energia e foco para tomar decisões estratégicas."
            />
          </div>
          {initialOverview.plan === "free" && (
            <div className="animate-fade-in [animation-delay:140ms]">
              <UpgradeCard
                planName={getPlanTitle("free")}
                onViewPlans={() =>
                  window.dispatchEvent(new Event("notura:open-plan-modal"))
                }
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
