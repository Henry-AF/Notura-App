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
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

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
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();

      const [profileRes, billingRes, meetingsRes] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", user.id).single(),
        supabase
          .from("billing_accounts")
          .select("plan, meetings_this_month")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("meetings")
          .select("id, title, client_name, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const [taskCountRes, openTasksRes, completedDurRes, todayMeetingsRes] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("completed", false),
          supabase
            .from("tasks")
            .select("id, description, completed, created_at")
            .eq("user_id", user.id)
            .eq("completed", false)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("meetings")
            .select("duration_seconds")
            .eq("user_id", user.id)
            .eq("status", "completed"),
          supabase
            .from("meetings")
            .select("id")
            .eq("user_id", user.id)
            .gte("created_at", startOfDay)
            .eq("status", "completed"),
        ]);

      const resolvedPlan = (billingRes.data?.plan ?? "free") as
        | "free"
        | "pro"
        | "team";
      const meetingsThisMonth = billingRes.data?.meetings_this_month ?? 0;
      const taskCount = taskCountRes.count ?? 0;
      const totalSeconds =
        completedDurRes.data?.reduce(
          (sum, m) => sum + (m.duration_seconds ?? 0),
          0
        ) ?? 0;
      const hoursSaved = Math.round(totalSeconds / 3600 / 2);

      const mappedMeetings: Meeting[] = (meetingsRes.data ?? []).map((m) => {
        const uiStatus: Meeting["status"] =
          m.status === "completed"
            ? "completed"
            : m.status === "failed"
            ? "failed"
            : "processing";
        return {
          id: m.id,
          clientName: m.client_name ?? m.title ?? "—",
          title: m.title ?? "—",
          date: formatRelativeTime(m.created_at),
          status: uiStatus,
        };
      });

      const mappedTasks: Task[] = (openTasksRes.data ?? []).map((t) => ({
        id: t.id,
        text: t.description,
        completed: t.completed,
        isNew: new Date(t.created_at) > new Date(Date.now() - 24 * 3600 * 1000),
      }));

      setUserName(
        profileRes.data?.name ?? user.email?.split("@")[0] ?? "Usuário"
      );
      setPlan(resolvedPlan);
      setTodayCount(todayMeetingsRes.data?.length ?? 0);
      setMetrics([
        {
          icon: "🎥",
          iconBg: "rgba(108,92,231,0.15)",
          iconColor: "#A29BFE",
          label: "Reuniões este mês",
          value: meetingsThisMonth,
          trend: { direction: "neutral", label: "ESTE MÊS" },
        },
        {
          icon: "✓",
          iconBg: "rgba(255,169,77,0.15)",
          iconColor: "#FFA94D",
          label: "Tarefas abertas",
          value: taskCount,
          trend: { direction: "neutral", label: "PENDENTE" },
        },
        {
          icon: "⏱",
          iconBg: "rgba(78,203,113,0.15)",
          iconColor: "#4ECB71",
          label: "Horas economizadas",
          value: hoursSaved,
          trend: { direction: "up", label: "SALVAS" },
        },
      ]);
      setMeetings(mappedMeetings);
      setTasks(mappedTasks);
      setLoading(false);
    }
    load();
  }, []);

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
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", id);
  }, [tasks]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 240,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "2px solid #6C5CE7",
            borderTopColor: "transparent",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const newCount = tasks.filter((t) => t.isNew && !t.completed).length;

  return (
    <>
      {/* Stagger animation styles */}
      <style>{`
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-in {
          animation: fade-slide-up 0.25s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      {/* Header */}
      <div className="anim-in" style={{ animationDelay: "0ms" }}>
        <DashboardHeader
          userName={userName}
          meetingsProcessedToday={todayCount}
          onNewMeeting={() => router.push("/dashboard/new")}
        />
      </div>

      {/* Main grid */}
      <div
        className="mt-6"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "24px",
        }}
      >
        {/* Two-column layout on large screens */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "24px",
            alignItems: "start",
          }}
          className="lg:dashboard-grid"
        >
          {/* Left column */}
          <div style={{ minWidth: 0 }}>
            {/* Metrics row */}
            <div className="anim-in" style={{ animationDelay: "60ms" }}>
              <MetricsRow metrics={metrics} />
            </div>

            {/* Recent meetings table */}
            <div className="anim-in mt-6" style={{ animationDelay: "120ms" }}>
              <RecentMeetingsTable
                meetings={meetings}
                onViewAll={() => router.push("/dashboard/meetings")}
                onRetry={handleRetry}
                onViewProcessing={handleViewProcessing}
                onRowClick={handleRowClick}
              />
            </div>
          </div>

          {/* Right sidebar */}
          <div
            className="flex flex-col gap-4"
            style={{ flexShrink: 0 }}
          >
            <div className="anim-in" style={{ animationDelay: "80ms" }}>
              <InsightCard
                title="Dicas de produtividade"
                body="Agende suas reuniões mais importantes pela manhã — você terá mais energia e foco para tomar decisões estratégicas."
              />
            </div>
            {plan === "free" && (
              <div className="anim-in" style={{ animationDelay: "140ms" }}>
                <UpgradeCard
                  planName="plano gratuito"
                  onViewPlans={() => router.push("/pricing")}
                />
              </div>
            )}
            <div className="anim-in" style={{ animationDelay: "200ms" }}>
              <TodayTasks
                tasks={tasks}
                newCount={newCount}
                onToggle={handleToggleTask}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Responsive grid style */}
      <style>{`
        @media (min-width: 1100px) {
          .lg\\:dashboard-grid {
            grid-template-columns: 1fr 320px !important;
          }
        }
        @media (max-width: 480px) {
          .meeting-date-col,
          .meeting-action-col {
            display: none !important;
          }
        }
      `}</style>
    </>
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
