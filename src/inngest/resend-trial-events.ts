import {
  hasTrialEmailEventBeenSent,
  markTrialEmailEventSent,
} from "@/lib/billing/trial-email-claims";
import type { ResendTrialEventData } from "@/lib/billing/trial-email-events";
import { inngest } from "@/lib/inngest";
import { logStructured } from "@/lib/observability";
import { isResendConfigured, sendResendEvent } from "@/lib/resend";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getUserEmailById } from "@/lib/user/user-email";

function parseResendTrialEventData(data: unknown): ResendTrialEventData {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid email/resend.trial-event payload.");
  }

  const value = data as Partial<ResendTrialEventData>;
  if (!value.resendEvent || !value.userId || !value.claimColumn || !value.payload) {
    throw new Error("Missing email/resend.trial-event identifiers.");
  }

  return {
    resendEvent: value.resendEvent,
    userId: value.userId,
    claimColumn: value.claimColumn,
    payload: value.payload,
  };
}

export const dispatchResendTrialEvent = inngest.createFunction(
  {
    id: "email-resend-trial-event",
    retries: 3,
    triggers: [{ event: "email/resend.trial-event" }],
  },
  async ({ event, step }) => {
    if (!isResendConfigured()) {
      logStructured("warn", {
        event: "email.resend.trial_event.skipped_not_configured",
        requestId: "n/a",
        route: "inngest/resend-trial-events",
        durationMs: 0,
        status: "skipped_not_configured",
      });
      return { skipped: "not_configured" };
    }

    const data = parseResendTrialEventData(event.data);
    const supabase = createServiceRoleClient();

    const alreadySent = await step.run("check-sent", () =>
      hasTrialEmailEventBeenSent(data.userId, data.claimColumn, supabase)
    );
    if (alreadySent) {
      return { skipped: "already_sent" };
    }

    const email = await step.run("resolve-email", () =>
      getUserEmailById(data.userId, supabase)
    );
    if (!email) {
      logStructured("warn", {
        event: "email.resend.trial_event.email_not_found",
        requestId: "n/a",
        route: "inngest/resend-trial-events",
        durationMs: 0,
        status: "email_not_found",
        userId: data.userId,
      });
      return { skipped: "email_not_found" };
    }

    await step.run("send", () =>
      sendResendEvent({ event: data.resendEvent, email, payload: data.payload })
    );

    await step.run("mark-sent", () =>
      markTrialEmailEventSent(data.userId, data.claimColumn, supabase)
    );

    return { sent: data.resendEvent };
  }
);
