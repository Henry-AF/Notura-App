import { NextResponse } from "next/server";
import { normalizeAuthNextPath } from "@/lib/auth-redirect";
import { createServerSupabase } from "@/lib/supabase/server";

function redirectToLogin(requestUrl: URL) {
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "oauth_callback_failed");
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectToLogin(requestUrl);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToLogin(requestUrl);
  }

  const nextPath = normalizeAuthNextPath(requestUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
