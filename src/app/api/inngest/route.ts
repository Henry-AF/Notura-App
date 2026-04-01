// ─────────────────────────────────────────────────────────────────────────────
// Inngest serve endpoint — registers all Inngest functions with the platform
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processMeeting, handleProcessMeetingFailure } from "@/inngest/process-meeting";

const handler = serve({
  client: inngest,
  functions: [processMeeting, handleProcessMeetingFailure],
});

export const { GET, POST, PUT } = handler;
