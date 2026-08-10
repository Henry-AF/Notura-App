import { getAppBaseUrl } from "@/lib/app-url";
import { inngest } from "@/lib/inngest";
import { logStructured } from "@/lib/observability";
import {
  listReengagementCandidates,
  markReengagementEmailSent,
  REENGAGEMENT_VARIANT,
  type ReengagementCandidate,
} from "@/lib/reengagement/email-claims";
import { isResendConfigured, sendResendEvent } from "@/lib/resend";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getUserEmailById } from "@/lib/user/user-email";

async function sendCandidate(candidate: ReengagementCandidate): Promise<"sent" | "email_not_found"> {
  const supabase = createServiceRoleClient();
  const email = await getUserEmailById(candidate.userId, supabase);
  if (!email) return "email_not_found";

  await sendResendEvent({
    event: "notura.reengagement_48h",
    email,
    payload: {
      user_id: candidate.userId,
      last_meeting_at: candidate.lastMeetingAt,
      days_since_last_meeting: String(candidate.daysSinceLastMeeting),
      upload_url: `${getAppBaseUrl()}/dashboard/recording?mode=upload`,
      variant: REENGAGEMENT_VARIANT,
    },
  });
  // Deliberately after Resend acceptance, matching NOT-161. A crash between
  // these operations can duplicate an event on retry; this is an accepted
  // residual risk because claiming first could permanently lose the email.
  await markReengagementEmailSent(candidate, supabase);
  return "sent";
}

export const dispatchReengagementEmails = inngest.createFunction(
  {
    id: "email-resend-reengagement-48h",
    retries: 3,
    triggers: [{ cron: "0 12 * * *" }],
  },
  async ({ step }) => {
    if (!isResendConfigured()) {
      logStructured("warn", {
        event: "email.resend.reengagement.skipped_not_configured",
        requestId: "n/a",
        route: "inngest/resend-reengagement",
        durationMs: 0,
        status: "skipped_not_configured",
      });
      return { skipped: "not_configured" };
    }

    const supabase = createServiceRoleClient();
    const candidates = await step.run("list-candidates", () =>
      listReengagementCandidates(supabase)
    );
    const results = await Promise.all(
      candidates.map((candidate) =>
        step.run(`send-${candidate.userId}`, () => sendCandidate(candidate))
      )
    );
    return {
      candidates: candidates.length,
      sent: results.filter((result) => result === "sent").length,
    };
  }
);
