import type {
  BillingEntitlementState,
  MeetingQuotaBlockCode,
} from "@/lib/billing";
import type { Plan } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  company: string;
  whatsappNumber: string;
  plan: Plan;
  effectivePlan: Plan;
  billingEntitlementStatus: BillingEntitlementState;
  isPaidPlanActive: boolean;
  canSendWhatsAppSummary: boolean;
  canProcessMeetings: boolean;
  meetingQuotaBlockCode: MeetingQuotaBlockCode | null;
  meetingQuotaLimit: number;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
  currentPeriodEnd: string | null;
  billingProvider: "stripe" | "abacatepay";
  autoRenewEnabled: boolean;
  renewalStatus: string;
  abacatepayAutoRenewEnabled: boolean;
  abacatepayRenewalStatus: string;
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
