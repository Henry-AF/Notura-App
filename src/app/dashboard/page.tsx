"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { ToastProvider, useToast } from "@/components/upload/Toast";
import { fetchDashboardOverview } from "./dashboard-api";
import { updateTaskById } from "./tasks/tasks-api";
import { LoadingState, PageShell } from "@/components/ui/app";

// ─── Inner page ───────────────────────────────────────────────────────────────

function DashboardPageInner() {
  const router = useRouter();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [plan, setPlan] = useState<"free" | "pro" | "team">("free");
  const [metrics, setMetrics] = useState<MetricCardProps[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const overview = await fetchDashboardOverview();
        if (cancelled) return;

        setUserName(overview.userName);
        setPlan(overview.plan);
        setTodayCount(overview.todayCount);
        setMetrics(overview.metrics);
        setMeetings(overview.meetings);
        setTasks(overview.tasks);
      } catch {
        if (!cancelled) {
          show("Erro ao carregar dashboard.", "error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [show]);

  const handleRetry = useCallback(
    async (id: string) => {
      show("Reprocessando...", "warning");
      try {
        const res = await fetch(`/api/meetings/${id}/retry`, { method: "POST" });
        if (!res.ok) throw new Error();
        setMeetings((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: "processing" as const } : m))
        );
        show("Reunião enviada para reprocessamento.", "success");
      } catch {
        show("Erro ao reprocessar. Tente novamente.", "error");
      }
    },
    [show]
  );

  const handleViewProcessing = useCallback(
    (id: string) => {
      router.push(`/dashboard/meetings/${id}`);
    },
    [router]
  );

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/dashboard/meetings/${id}`);
    },
    [router]
  );

  const handleToggleTask = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newCompleted = !task.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: newCompleted, isNew: false } : t))
    );
    // Update open-task count metric in real time
    setMetrics((prev) =>
      prev.map((m) =>
        m.label === "Tarefas abertas"
          ? { ...m, value: Math.max(0, (m.value as number) + (newCompleted ? -1 : 1)) }
          : m
      )
    );
    try {
      await updateTaskById(id, { status: newCompleted ? "completed" : "todo" });
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, completed: task.completed, isNew: task.isNew } : t
        )
      );
      setMetrics((prev) =>
        prev.map((m) =>
          m.label === "Tarefas abertas"
            ? { ...m, value: Math.max(0, (m.value as number) + (newCompleted ? 1 : -1)) }
            : m
        )
      );
      show("Erro ao atualizar tarefa.", "error");
    }
  }, [tasks, show]);

  if (loading) {
    return <LoadingState label="Carregando dashboard..." />;
  }

  const newCount = tasks.filter((t) => t.isNew && !t.completed).length;

  return (
    <PageShell>
      <div className="animate-fade-in">
        <DashboardHeader
          userName={userName}
          meetingsProcessedToday={todayCount}
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
              onViewProcessing={handleViewProcessing}
              onRowClick={handleRowClick}
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
          {plan === "free" && (
            <div className="animate-fade-in [animation-delay:140ms]">
              <UpgradeCard
                planName="plano gratuito"
                onViewPlans={() => router.push("/pricing")}
              />
            </div>
          )}
          <div className="animate-fade-in [animation-delay:200ms]">
            <TodayTasks
              tasks={tasks}
              newCount={newCount}
              onToggle={handleToggleTask}
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardPageInner />
    </ToastProvider>
  );
}
