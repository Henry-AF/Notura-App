"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BannerCarousel,
  DashboardCalendarPanel,
  DashboardHeader,
  MetricsRow,
  RecentMeetingsTable,
  InsightCard,
  UpgradeCard,
} from "@/components/dashboard";
import type { MetricCardProps, Meeting } from "@/components/dashboard";
import { useToast } from "@/components/upload/Toast";
import { PageShell } from "@/components/ui/app";
import { getPlanTitle } from "@/lib/plans";
import type { DashboardOverviewData } from "./dashboard-types";

export interface DashboardClientProps {
  initialOverview: DashboardOverviewData;
}

export function DashboardClient({ initialOverview }: DashboardClientProps) {
  const router = useRouter();
  const { show } = useToast();

  const [metrics, setMetrics] = useState<MetricCardProps[]>(
    initialOverview.metrics
  );
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
    const prefetchSafely = (href: string) => {
      router.prefetch(href);
    };

    prefetchSafely("/dashboard/recording");
    prefetchSafely("/dashboard/new");
    prefetchSafely("/dashboard/meetings");
  }, [router]);

  return (
    <PageShell>
      <div className="animate-fade-in">
        <DashboardHeader
          userName={initialOverview.userName}
          meetingsProcessedToday={initialOverview.todayCount}
          onRecord={() => router.push("/dashboard/recording")}
          onUpload={() => router.push("/dashboard/new")}
        />
      </div>

      <div className="mt-6 animate-fade-in [animation-delay:40ms]">
        <BannerCarousel />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="min-w-0">
          <div className="animate-fade-in [animation-delay:60ms]">
            <MetricsRow metrics={metrics} />
          </div>

          <div className="mt-6 animate-fade-in [animation-delay:120ms]">
            <RecentMeetingsTable
              meetings={meetings}
              viewAllHref="/dashboard/meetings"
              onRetry={handleRetry}
              onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}
              onRowClick={(id) => router.push(`/dashboard/meetings/${id}`)}
            />
          </div>
        </div>

        <div className="min-w-0 flex flex-col gap-4">
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
          <div className="animate-fade-in [animation-delay:180ms]">
            <DashboardCalendarPanel />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
