import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[auth/logout] POST failed:", error);
    return NextResponse.json(
      { error: "Erro ao encerrar sessão." },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
