import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildInactivityEmailCampaign,
  buildWelcomeEmailCampaign,
  type EmailCampaign,
  type InactivityEmailCampaign,
} from "@/lib/email/campaigns";
import { sendReactEmail } from "@/lib/email/resend";
import { getPostHogClient } from "@/lib/posthog-server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

interface EmailRecipient {
  userId: string;
  email: string;
  name: string | null;
}

export interface InactivityEmailRecipient extends EmailRecipient {
  meetingsUsed: number;
  quotaLimit: number;
}

export type EmailDeliveryResult =
  | { status: "sent"; deliveryId: string; resendEmailId: string | null }
  | { status: "skipped"; reason: "duplicate" };

function isUniqueViolation(error: { code?: string | null }): boolean {
  return error.code === "23505";
}

function captureEmailEvent(input: {
  userId: string;
  event: string;
  campaign: EmailCampaign | InactivityEmailCampaign;
}): void {
  const properties: Record<string, unknown> = {
    email_type: input.campaign.emailType,
    campaign: input.campaign.campaign,
  };

  if ("quotaRemaining" in input.campaign) {
    properties.meetings_used = input.campaign.meetingsUsed;
    properties.quota_remaining = input.campaign.quotaRemaining;
    properties.quota_limit = input.campaign.quotaLimit;
  }

  try {
    getPostHogClient().capture({
      distinctId: input.userId,
      event: input.event,
      properties,
    });
  } catch (error) {
    console.warn("[email] Failed to capture PostHog email event", error);
  }
}

async function reserveDelivery(
  supabase: SupabaseAdminClient,
  userId: string,
  campaign: EmailCampaign
): Promise<string | null> {
  const { data, error } = await supabase
    .from("email_deliveries")
    .insert({
      user_id: userId,
      email_type: campaign.emailType,
      campaign: campaign.campaign,
    })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return null;
    throw new Error(`Failed to reserve email delivery: ${error.message}`);
  }

  return data.id;
}

async function markDeliverySent(
  supabase: SupabaseAdminClient,
  deliveryId: string,
  resendEmailId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("email_deliveries")
    .update({
      resend_email_id: resendEmailId,
      sent_at: new Date().toISOString(),
    })
    .eq("id", deliveryId);

  if (error) throw new Error(`Failed to mark email delivery sent: ${error.message}`);
}

async function releaseDelivery(
  supabase: SupabaseAdminClient,
  deliveryId: string
): Promise<void> {
  await supabase.from("email_deliveries").delete().eq("id", deliveryId);
}

async function sendEmailCampaignOnce(input: {
  recipient: EmailRecipient;
  campaign: EmailCampaign | InactivityEmailCampaign;
  supabase: SupabaseAdminClient;
}): Promise<EmailDeliveryResult> {
  const deliveryId = await reserveDelivery(
    input.supabase,
    input.recipient.userId,
    input.campaign
  );

  if (!deliveryId) {
    captureEmailEvent({
      userId: input.recipient.userId,
      event: `email_${input.campaign.emailType}_skipped`,
      campaign: input.campaign,
    });
    return { status: "skipped", reason: "duplicate" };
  }

  try {
    const resendEmailId = await sendReactEmail({
      to: input.recipient.email,
      subject: input.campaign.subject,
      react: input.campaign.element,
    });
    await markDeliverySent(input.supabase, deliveryId, resendEmailId);
    captureEmailEvent({
      userId: input.recipient.userId,
      event: `email_${input.campaign.emailType}_sent`,
      campaign: input.campaign,
    });
    return { status: "sent", deliveryId, resendEmailId };
  } catch (error) {
    await releaseDelivery(input.supabase, deliveryId);
    captureEmailEvent({
      userId: input.recipient.userId,
      event: `email_${input.campaign.emailType}_failed`,
      campaign: input.campaign,
    });
    throw error;
  }
}

export function sendWelcomeEmailOnce(
  recipient: EmailRecipient,
  supabase: SupabaseAdminClient = createServiceRoleClient()
): Promise<EmailDeliveryResult> {
  return sendEmailCampaignOnce({
    recipient,
    campaign: buildWelcomeEmailCampaign({ name: recipient.name }),
    supabase,
  });
}

export function sendInactivityEmailOnce(
  recipient: InactivityEmailRecipient,
  supabase: SupabaseAdminClient = createServiceRoleClient()
): Promise<EmailDeliveryResult> {
  return sendEmailCampaignOnce({
    recipient,
    campaign: buildInactivityEmailCampaign({
      name: recipient.name,
      meetingsUsed: recipient.meetingsUsed,
      quotaLimit: recipient.quotaLimit,
    }),
    supabase,
  });
}
