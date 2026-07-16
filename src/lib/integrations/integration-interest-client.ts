import { normalizeError, parseJson } from "@/lib/api-client";
import type { IntegrationChannel } from "./integration-interest";

interface RegisterIntegrationInterestResponse {
  channel?: IntegrationChannel;
  error?: string;
}

interface FetchIntegrationInterestResponse {
  channels?: IntegrationChannel[];
  error?: string;
}

export async function registerIntegrationInterest(
  channel: IntegrationChannel
): Promise<void> {
  const response = await fetch("/api/integration-interest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel }),
  });
  const body = await parseJson<RegisterIntegrationInterestResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Erro ao registrar interesse na integração.")
    );
  }
}

export async function fetchIntegrationInterest(): Promise<IntegrationChannel[]> {
  const response = await fetch("/api/integration-interest", { method: "GET" });
  const body = await parseJson<FetchIntegrationInterestResponse>(response);

  if (!response.ok || !body.channels) {
    throw new Error(
      normalizeError(body.error, "Erro ao buscar interesse em integrações.")
    );
  }

  return body.channels;
}
