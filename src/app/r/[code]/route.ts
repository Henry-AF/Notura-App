import { NextResponse } from "next/server";
import {
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
} from "@/lib/referral-cookie";
import { findActiveReferralCode } from "@/lib/referrals";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL("/signup", requestUrl.origin));

  const referral = await findActiveReferralCode(code);
  if (referral) {
    const cookieValue = encodeURIComponent(
      JSON.stringify({ code: referral.code, clickedAt: new Date().toISOString() })
    );
    response.cookies.set(REFERRAL_COOKIE_NAME, cookieValue, {
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
