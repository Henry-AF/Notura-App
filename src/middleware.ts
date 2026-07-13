import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeAuthNextPath } from "@/lib/auth-redirect";

function redirectAuthenticatedFromLogin(request: NextRequest): NextResponse {
  const nextPath = normalizeAuthNextPath(request.nextUrl.searchParams.get("redirectTo"));
  const target = new URL(nextPath, request.nextUrl.origin);
  return NextResponse.redirect(target);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    const origin = request.headers.get("origin");
    const allowedOrigins = [
      "http://localhost:11000",
      "http://localhost:21377",
      "https://app.notura.com.br",
    ];
    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    if (isAllowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }

    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      request.headers.get("access-control-request-headers") ??
        "Content-Type, Authorization, X-Client-Info, X-Supabase-Auth, Apollo-Require-Preflight"
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin) {
        return new NextResponse(null, { status: 403 });
      }

      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }

    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session (required for Supabase SSR token rotation).
  // A stale or revoked refresh token (refresh_token_not_found) must be treated
  // as unauthenticated — clear the session cookies and redirect to login.
  let user = null;
  let shouldClearAuthCookies = false;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (result.error?.code === "refresh_token_not_found") {
      await supabase.auth.signOut();
      shouldClearAuthCookies = true;
      user = null;
    }
  } catch {
    user = null;
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    if (shouldClearAuthCookies) {
      // Clear confirmed stale auth cookies so they don't loop.
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith("sb-")) {
          redirectResponse.cookies.delete(name);
        }
      });
    }
    return redirectResponse;
  }

  // Redirect authenticated users away from the login page
  if (user && request.nextUrl.pathname === "/login") {
    return redirectAuthenticatedFromLogin(request);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/login"],
};
