import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  formatMissingEnvMessage,
  getMissingSupabaseEnvVars,
  getMissingSupabaseServiceEnvVars,
  getOptionalSupabaseBrowserConfig,
  getSupabaseBrowserConfig,
  getSupabaseServiceRoleKey,
} from "@/lib/env";
import type { Database } from "@/types/database";

export function createOptionalServerSupabase() {
  const cookieStore = cookies();
  const config = getOptionalSupabaseBrowserConfig();

  if (!config) {
    return null;
  }

  return createServerClient<Database>(
    config.url,
    config.anonKey,
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

export function createServerSupabase() {
  const supabase = createOptionalServerSupabase();

  if (!supabase) {
    throw new Error(formatMissingEnvMessage(getMissingSupabaseEnvVars()));
  }

  return supabase;
}

export function createOptionalServiceRoleClient() {
  const config = getOptionalSupabaseBrowserConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!config || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(
    config.url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function createServiceRoleClient() {
  const supabase = createOptionalServiceRoleClient();

  if (!supabase) {
    throw new Error(formatMissingEnvMessage(getMissingSupabaseServiceEnvVars()));
  }

  return supabase;
}
