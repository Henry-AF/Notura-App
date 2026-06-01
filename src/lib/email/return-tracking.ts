export interface EmailReturnEvent {
  event: "email_returned_to_app";
  properties: {
    campaign: string;
    email_type: string;
    source: "resend";
    medium: "email";
  };
}

export function buildEmailReturnEvent(
  searchParams: URLSearchParams
): EmailReturnEvent | null {
  const source = searchParams.get("utm_source");
  const medium = searchParams.get("utm_medium");
  if (source !== "resend" || medium !== "email") return null;

  const campaign = searchParams.get("utm_campaign");
  const emailType = searchParams.get("notura_email") ?? campaign;
  if (!campaign || !emailType) return null;

  return {
    event: "email_returned_to_app",
    properties: {
      campaign,
      email_type: emailType,
      source,
      medium,
    },
  };
}
