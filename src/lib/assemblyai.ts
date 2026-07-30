import { AssemblyAI } from "assemblyai";

// Temporary tokens for AssemblyAI's v3 streaming API (Universal-Streaming) can
// be requested for at most 600 seconds; the client connects immediately after
// receiving one, so there is no benefit to requesting a shorter TTL.
const STREAMING_TOKEN_TTL_SECONDS = 600;

function requireAssemblyAiApiKey(): string {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error("ASSEMBLYAI_API_KEY não configurado no servidor.");
  }
  return apiKey;
}

/**
 * Short-lived token that lets the browser open a direct WebSocket connection
 * to AssemblyAI's v3 streaming API (Universal-Streaming) without exposing the
 * real API key. Used only for the live, throwaway draft transcript shown
 * during recording — the final transcript keeps going through the batch
 * flow in `src/inngest/process-meeting.ts`.
 */
export async function createStreamingToken(): Promise<string> {
  const client = new AssemblyAI({ apiKey: requireAssemblyAiApiKey() });
  return await client.streaming.createTemporaryToken({
    expires_in_seconds: STREAMING_TOKEN_TTL_SECONDS,
  });
}
