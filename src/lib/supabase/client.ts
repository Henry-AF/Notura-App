import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserConfig();
  return createBrowserClient<Database>(url, anonKey);
}
