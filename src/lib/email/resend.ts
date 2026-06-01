import type { ReactElement } from "react";
import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getEmailFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Notura <onboarding@resend.dev>";
}

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Missing environment variable RESEND_API_KEY.");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendReactEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<string | null> {
  const result = await getResendClient().emails.send({
    from: getEmailFromAddress(),
    to: input.to,
    subject: input.subject,
    react: input.react,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data?.id ?? null;
}
