// NEXT_PUBLIC_* vars must be accessed as static string literals so Next.js
// can inline them at build time. Dynamic bracket access (process.env[name])
// does NOT work for these variables in the browser bundle.

const missingSupabaseEnvWarnings = new Set<string>();

type SupabaseBrowserConfig = {
  url: string;
  anonKey: string;
};

type SupabaseEnvName =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

function getSupabaseBrowserEnvValues() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getMissingSupabaseEnvVars(): SupabaseEnvName[] {
  const { url, anonKey } = getSupabaseBrowserEnvValues();
  const missing: SupabaseEnvName[] = [];

  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}

export function getMissingSupabaseServiceEnvVars(): SupabaseEnvName[] {
  const missing = getMissingSupabaseEnvVars();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function formatMissingEnvMessage(variableNames: readonly string[]): string {
  return `Missing environment variable${variableNames.length === 1 ? "" : "s"} ${variableNames.join(", ")}. Add ${variableNames.length === 1 ? "it" : "them"} to .env.local and restart the dev server.`;
}

export function getOptionalSupabaseBrowserConfig(): SupabaseBrowserConfig | null {
  const { url, anonKey } = getSupabaseBrowserEnvValues();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function warnMissingSupabaseEnv(context: string, variableNames = getMissingSupabaseEnvVars()): void {
  if (variableNames.length === 0) {
    return;
  }

  const warningKey = `${context}:${variableNames.join(",")}`;
  if (missingSupabaseEnvWarnings.has(warningKey)) {
    return;
  }

  missingSupabaseEnvWarnings.add(warningKey);
  console.warn(`[supabase] ${context}: ${formatMissingEnvMessage(variableNames)} Auth-protected routes will run in fallback mode until Supabase is configured.`);
}

export function getSupabaseBrowserConfig() {
  const config = getOptionalSupabaseBrowserConfig();

  if (!config) {
    throw new Error(formatMissingEnvMessage(getMissingSupabaseEnvVars()));
  }

  return config;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      formatMissingEnvMessage(["SUPABASE_SERVICE_ROLE_KEY"]),
    );
  return key;
}
