import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/user/account

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // TODO: delete user data from database tables before removing auth user
  // For now, just sign out (real deletion would call supabase admin API)
  await supabase.auth.signOut();

  return NextResponse.json({ success: true }, { status: 200 });
}
