import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const ACTIVATION_EVENT = {
  signup: "signup",
  recordingStarted: "primeira_gravacao_iniciada",
  minutesDelivered: "primeira_ata_entregue",
  minutesViewed: "primeira_ata_visualizada",
} as const;

export type ActivationChannel = "in_app" | "whatsapp";
export interface ActivationMetrics {
  signupCount: number;
  recordingCount: number;
  deliveredCount: number;
  viewedCount: number;
  signupToRecordingPct: number;
  recordingToDeliveredPct: number;
  deliveredToViewedPct: number;
  activationRatePct: number;
  medianActivationMinutes: number | null;
  inAppActivations: number;
  whatsappActivations: number;
}

type ActivationClient = SupabaseClient<Database>;

export async function recordActivationEvent(input: {
  supabase: ActivationClient;
  userId: string;
  eventName: (typeof ACTIVATION_EVENT)[keyof typeof ACTIVATION_EVENT];
  meetingId?: string;
  channel?: ActivationChannel;
}): Promise<boolean> {
  const { data, error } = await input.supabase.rpc("record_activation_event", {
    p_user_id: input.userId,
    p_event_name: input.eventName,
    p_meeting_id: input.meetingId,
    p_channel: input.channel,
  });
  if (error) throw new Error(`Failed to record activation event: ${error.message}`);
  return data;
}

export async function getActivationMetrics(now = new Date()): Promise<ActivationMetrics> {
  const cohortStart = new Date(now);
  cohortStart.setUTCHours(0, 0, 0, 0);
  cohortStart.setUTCDate(cohortStart.getUTCDate() - cohortStart.getUTCDay());
  const { data, error } = await createServiceRoleClient().rpc(
    "get_activation_funnel_metrics",
    { p_cohort_start: cohortStart.toISOString(), p_cohort_end: now.toISOString() },
  );
  if (error) throw new Error(`Failed to load activation metrics: ${error.message}`);
  return mapActivationMetrics(data[0]);
}

export function mapActivationMetrics(row: Database["public"]["Functions"]["get_activation_funnel_metrics"]["Returns"][number]): ActivationMetrics {
  return {
    signupCount: row.signup_count,
    recordingCount: row.recording_count,
    deliveredCount: row.delivered_count,
    viewedCount: row.viewed_count,
    signupToRecordingPct: Number(row.signup_to_recording_pct ?? 0),
    recordingToDeliveredPct: Number(row.recording_to_delivered_pct ?? 0),
    deliveredToViewedPct: Number(row.delivered_to_viewed_pct ?? 0),
    activationRatePct: Number(row.activation_rate_pct ?? 0),
    medianActivationMinutes: row.median_activation_minutes === null ? null : Number(row.median_activation_minutes),
    inAppActivations: row.in_app_activations,
    whatsappActivations: row.whatsapp_activations,
  };
}
