export const REFERRAL_COOKIE_NAME = "notura_referral";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface ReferralCookiePayload {
  code: string;
  clickedAt: string;
}

export function parseReferralCookieValue(raw: string): ReferralCookiePayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ReferralCookiePayload>;
    if (typeof parsed.code === "string" && typeof parsed.clickedAt === "string") {
      return { code: parsed.code, clickedAt: parsed.clickedAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function readReferralCookie(): ReferralCookiePayload | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${REFERRAL_COOKIE_NAME}=([^;]*)`)
  );
  return match ? parseReferralCookieValue(match[1]) : null;
}
