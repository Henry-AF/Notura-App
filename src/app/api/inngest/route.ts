// ─────────────────────────────────────────────────────────────────────────────
// Inngest serve endpoint — registers all Inngest functions with the platform
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processMeeting } from "@/inngest/process-meeting";

const handler = serve({
  client: inngest,
  functions: [processMeeting],
});

export const { GET, POST, PUT } = handler;
