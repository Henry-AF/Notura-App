export const INTEGRATION_CHANNELS = [
  "zoom",
  "chrome_extension",
  "google_calendar",
] as const;

export type IntegrationChannel = (typeof INTEGRATION_CHANNELS)[number];

export function isIntegrationChannel(value: unknown): value is IntegrationChannel {
  return (
    typeof value === "string" &&
    INTEGRATION_CHANNELS.includes(value as IntegrationChannel)
  );
}
