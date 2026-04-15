"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardHeader,
  MetricsRow,
  RecentMeetingsTable,
  InsightCard,
  UpgradeCard,
  TodayTasks,
} from "@/components/dashboard";
import type { MetricCardProps, Meeting, Task } from "@/components/dashboard";
import { useToast } from "@/components/upload/Toast";
import { PageShell } from "@/components/ui/app";
import { getPlanTitle } from "@/lib/plans";
import type { DashboardOverviewData } from "./dashboard-types";
import { updateTaskById } from "./tasks/tasks-api";

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
  const [tasks, setTasks] = useState<Task[]>(initialOverview.tasks);

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

  const handleToggleTask = useCallback(
    async (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;

      const newCompleted = !task.completed;
      setTasks((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, completed: newCompleted, isNew: false } : item
        )
      );

      setMetrics((previous) =>
        previous.map((metric) =>
          metric.label === "Tarefas abertas"
            ? {
                ...metric,
                value: Math.max(0, (metric.value as number) + (newCompleted ? -1 : 1)),
              }
            : metric
        )
      );

      try {
        await updateTaskById(id, { status: newCompleted ? "completed" : "todo" });
      } catch {
        setTasks((previous) =>
          previous.map((item) =>
            item.id === id
              ? { ...item, completed: task.completed, isNew: task.isNew }
              : item
          )
        );
        setMetrics((previous) =>
          previous.map((metric) =>
            metric.label === "Tarefas abertas"
              ? {
                  ...metric,
                  value: Math.max(0, (metric.value as number) + (newCompleted ? 1 : -1)),
                }
              : metric
          )
        );
        show("Erro ao atualizar tarefa.", "error");
      }
    },
    [show, tasks]
  );

  const newCount = useMemo(
    () => tasks.filter((task) => task.isNew && !task.completed).length,
    [tasks]
  );

  useEffect(() => {
    void router.prefetch("/dashboard/new");
    void router.prefetch("/dashboard/meetings");
    meetings.slice(0, 8).forEach((meeting) => {
      void router.prefetch(`/dashboard/meetings/${meeting.id}`);
    });
  }, [meetings, router]);

  return (
    <PageShell>
      <div className="animate-fade-in">
        <DashboardHeader
          userName={initialOverview.userName}
          meetingsProcessedToday={initialOverview.todayCount}
          onNewMeeting={() => router.push("/dashboard/new")}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0">
          <div className="animate-fade-in [animation-delay:60ms]">
            <MetricsRow metrics={metrics} />
          </div>

          <div className="mt-6 animate-fade-in [animation-delay:120ms]">
            <RecentMeetingsTable
              meetings={meetings}
              onViewAll={() => router.push("/dashboard/meetings")}
              onRetry={handleRetry}
              onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}
              onRowClick={(id) => router.push(`/dashboard/meetings/${id}`)}
            />
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
          <div className="animate-fade-in [animation-delay:200ms]">
            <TodayTasks tasks={tasks} newCount={newCount} onToggle={handleToggleTask} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
