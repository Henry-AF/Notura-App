import type { MetricCardProps, Meeting } from "@/components/dashboard";
import type { Plan } from "@/types/database";
import type { ActivationMetrics } from "@/lib/activation";

export interface DashboardOverviewData {
  userName: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
  meetings: Meeting[];
  metrics: MetricCardProps[];
  todayCount: number;
  activation: ActivationMetrics;
}
