import { NextResponse } from "next/server";
import { createServerSupabase, createServiceRoleClient } from "@/lib/supabase/server";
import { getSupabaseBrowserConfig, getSupabaseServiceRoleKey } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

// DELETE /api/user/account — Permanently delete the authenticated user's account
export async function DELETE() {
  // ── Identify the authenticated user ──────────────────────────────────────
  const supabaseAuth = createServerSupabase();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const userId = user.id;
  const supabase = createServiceRoleClient();

  // ── Delete user data from application tables ──────────────────────────────
  // ON DELETE CASCADE on meetings → tasks, decisions, open_items are removed
  // automatically. We still delete profiles explicitly.
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    console.error("[user/account] profile delete error:", profileError);
    return NextResponse.json({ error: "Erro ao remover dados do usuário." }, { status: 500 });
  }

  // ── Delete the auth.users record via Admin API ────────────────────────────
  const { url } = getSupabaseBrowserConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteAuthError) {
    console.error("[user/account] auth delete error:", deleteAuthError);
    return NextResponse.json({ error: "Erro ao remover conta de autenticação." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
