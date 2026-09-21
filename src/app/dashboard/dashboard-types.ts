import type { MetricCardProps, Meeting } from "@/components/dashboard";
import type { Plan } from "@/types/database";

export interface DashboardOverviewData {
  userName: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
  meetings: Meeting[];
  metrics: MetricCardProps[];
  todayCount: number;
}
