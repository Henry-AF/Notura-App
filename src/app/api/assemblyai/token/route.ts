// POST /api/assemblyai/token
// Returns a short-lived temporary token for AssemblyAI's v3 streaming API
// (Universal-Streaming). The token is safe to expose to the browser.

import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";
import { createStreamingToken } from "@/lib/assemblyai";

export const POST = withAuthRateLimit(
  RATE_LIMIT_POLICIES.assemblyAiToken,
  async () => {
    try {
      const token = await createStreamingToken();
      return NextResponse.json({ token });
    } catch (err) {
      console.error("[assemblyai/token] Failed to create streaming token:", err);
      return NextResponse.json(
        { error: "Falha ao gerar token de transcrição." },
        { status: 502 }
      );
    }
  }
);
