"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionCard } from "@/components/ui/app";
import { cn } from "@/lib/utils";
import { fetchGroupDashboard, type GroupDashboardView } from "./group-dashboard-api";

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <PageShell>
      <SectionCard className="rounded-[22px] px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Grupo não encontrado ou você não tem acesso a ele.
        </p>
        <Button
          type="button"
          className={cn(
            "mt-4 rounded-full px-6 transition-transform duration-200 ease-[cubic-bezier(0.3,0,0.1,1)] active:scale-[0.96]"
          )}
          onClick={onBack}
        >
          Voltar
        </Button>
      </SectionCard>
    </PageShell>
  );
}

interface IndicatorCard {
  key: string;
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}

function buildIndicatorCards(dashboard: GroupDashboardView): IndicatorCard[] {
  return [
    { key: "meetings", label: "Reunioes", value: dashboard.meetingsCount, icon: CalendarDays },
    { key: "minutes", label: "Atas geradas", value: dashboard.minutesCount, icon: FileText },
    { key: "tasksTotal", label: "Tarefas totais", value: dashboard.tasksTotal, icon: ListChecks },
    { key: "tasksPending", label: "Tarefas pendentes", value: dashboard.tasksPending, icon: Clock3 },
    { key: "tasksCompleted", label: "Tarefas concluidas", value: dashboard.tasksCompleted, icon: CheckCircle2 },
    { key: "decisions", label: "Decisoes registradas", value: dashboard.decisionsCount, icon: Gavel },
    { key: "upcoming", label: "Proximas reunioes", value: dashboard.upcomingMeetingsCount, icon: CalendarClock },
  ];
}

function IndicatorCardView({ card }: { card: IndicatorCard }) {
  const Icon = card.icon;

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="flex size-9 items-center justify-center rounded-full bg-[#5E4CEB]/10 text-[#5E4CEB]">
        <Icon className="size-[18px]" />
      </div>
      <p className="text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
        {card.value}
      </p>
      <p className="text-[13px] leading-[1.3] tracking-[0.01em] text-muted-foreground">
        {card.label}
      </p>
    </div>
  );
}

function buildEmptyDashboardView(groupId: string): GroupDashboardView {
  return {
    groupId,
    meetingsCount: 0,
    minutesCount: 0,
    tasksTotal: 0,
    tasksPending: 0,
    tasksCompleted: 0,
    decisionsCount: 0,
    upcomingMeetingsCount: 0,
  };
}

export function GroupDashboardClient({
  groupId,
  groupName,
  initialDashboard,
}: {
  groupId: string;
  groupName: string | null;
  initialDashboard: GroupDashboardView | null;
}) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(
    initialDashboard ?? buildEmptyDashboardView(groupId)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setIsRefreshing(true);
    setError(null);
    try {
      setDashboard(await fetchGroupDashboard(groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar indicadores.");
    } finally {
      setIsRefreshing(false);
    }
  }

  if (initialDashboard === null || groupName === null) {
    return <NotFoundState onBack={() => router.push("/dashboard/groups")} />;
  }

  const cards = buildIndicatorCards(dashboard);

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Grupos", href: "/dashboard/groups" },
          { label: groupName },
        ]}
        title={`Indicadores: ${groupName}`}
        description="Acompanhe reunioes, atas, tarefas e decisoes deste grupo."
        actions={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "rounded-full px-5 transition-transform duration-200 ease-[cubic-bezier(0.3,0,0.1,1)] active:scale-[0.96]"
            )}
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <IndicatorCardView key={card.key} card={card} />
        ))}
      </div>
    </PageShell>
  );
}
