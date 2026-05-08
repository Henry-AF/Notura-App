const DEFAULT_AUTH_NEXT_PATH = "/dashboard";

export function normalizeAuthNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return DEFAULT_AUTH_NEXT_PATH;
  }

  return nextPath;
}

export function buildOAuthCallbackUrl(origin: string, nextPath: string): string {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", normalizeAuthNextPath(nextPath));
  return callbackUrl.toString();
}
