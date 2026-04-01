import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseBrowserConfig, getSupabaseServiceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

export function createServerSupabase() {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseBrowserConfig();
  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}

export function createServiceRoleClient() {
  const { url } = getSupabaseBrowserConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient<Database>(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
