import { getBillingStatus } from "@/lib/billing";
import { sendInactivityEmailOnce } from "@/lib/email/delivery";
import { inngest } from "@/lib/inngest";
import { createServiceRoleClient } from "@/lib/supabase/server";

const INACTIVITY_DAYS = 3;
const PAGE = 1;
const PER_PAGE = 1000;

interface AuthUserForEmail {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
}

function readName(metadata: Record<string, unknown> | undefined): string | null {
  const fullName = metadata?.full_name;
  return typeof fullName === "string" && fullName.trim() ? fullName : null;
}

function getLastActivityAt(user: AuthUserForEmail): Date | null {
  const value = user.last_sign_in_at ?? user.created_at;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isInactiveForThreeDays(user: AuthUserForEmail, now: Date): boolean {
  const lastActivityAt = getLastActivityAt(user);
  if (!lastActivityAt) return false;

  const cutoff = now.getTime() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
  return lastActivityAt.getTime() <= cutoff;
}

async function fetchAuthUsers(): Promise<AuthUserForEmail[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: PAGE,
    perPage: PER_PAGE,
  });

  if (error) {
    throw new Error(`Failed to list auth users for inactivity email: ${error.message}`);
  }

  return data.users;
}

async function sendEmailForUser(user: AuthUserForEmail): Promise<"sent" | "skipped"> {
  if (!user.email) return "skipped";

  const billing = await getBillingStatus(user.id);
  const result = await sendInactivityEmailOnce({
    userId: user.id,
    email: user.email,
    name: readName(user.user_metadata),
    meetingsUsed: billing.meetingsUsed,
    quotaLimit: billing.quotaStatus.quotaLimit,
  });

  return result.status;
}

export const sendUserInactivityEmails = inngest.createFunction(
  {
    id: "send-user-inactivity-emails",
    retries: 0,
    triggers: [
      { event: "email/user-inactivity.scan" },
      { cron: "0 13 * * *" },
    ],
  },
  async ({ step }) => {
    const now = new Date();
    const users = await step.run("fetch-auth-users", fetchAuthUsers);
    const results = {
      sent: 0,
      skipped: 0,
      failed: 0,
    };

    for (const user of users) {
      if (!isInactiveForThreeDays(user, now)) {
        results.skipped += 1;
        continue;
      }

      try {
        const status = await step.run(`send-inactivity-email-${user.id}`, () =>
          sendEmailForUser(user)
        );
        results[status] += 1;
      } catch {
        results.failed += 1;
      }
    }

    return results;
  }
);
