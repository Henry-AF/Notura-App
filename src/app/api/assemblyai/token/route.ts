// POST /api/assemblyai/token
// Returns a short-lived temporary token for AssemblyAI real-time transcription.
// The token is safe to expose to the browser and expires after 8 minutes.

import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/api/rate-limit-route";
import { RATE_LIMIT_POLICIES } from "@/lib/api/rate-limit-policies";

export const POST = withAuthRateLimit(
  RATE_LIMIT_POLICIES.assemblyAiToken,
  async () => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ASSEMBLYAI_API_KEY não configurado no servidor." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch("https://api.assemblyai.com/v2/realtime/token", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_in: 480 }), // 8 minutes
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[assemblyai/token] API error:", res.status, text);
      return NextResponse.json(
        { error: "Falha ao obter token de transcrição." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { token: string };
    return NextResponse.json({ token: data.token });
  } catch (err) {
    console.error("[assemblyai/token] Unexpected error:", err);
    return NextResponse.json(
      { error: "Erro interno ao gerar token." },
      { status: 500 }
    );
  }
  }
);
