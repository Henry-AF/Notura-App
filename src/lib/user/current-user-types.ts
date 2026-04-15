import type { Plan } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  company: string;
  whatsappNumber: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
}

export interface CurrentUserIdentity {
  id: string;
  email: string | null;
}

export interface UpdateCurrentUserInput {
  name?: string;
  company?: string;
  whatsappNumber?: string | null;
}
