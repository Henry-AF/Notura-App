import type { MetricCardProps, Meeting, Task } from "@/components/dashboard";
import type { Plan } from "@/types/database";

export interface DashboardOverviewData {
  userName: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
  meetings: Meeting[];
  tasks: Task[];
  metrics: MetricCardProps[];
  todayCount: number;
}
