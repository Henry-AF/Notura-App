// NEXT_PUBLIC_* vars must be accessed as static string literals so Next.js
// can inline them at build time. Dynamic bracket access (process.env[name])
// does NOT work for these variables in the browser bundle.

export function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url)
    throw new Error(
      "Missing environment variable NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local and restart the dev server.",
    );
  if (!anonKey)
    throw new Error(
      "Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to .env.local and restart the dev server.",
    );

  return { url, anonKey } as const;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "Missing environment variable SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local and restart the dev server.",
    );
  return key;
}
