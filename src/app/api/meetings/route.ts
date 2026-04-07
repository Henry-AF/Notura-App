import { NextResponse } from "next/server";
import {
  createServerSupabase,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export async function GET() {
  const supabaseAuth = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, client_name, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/meetings] failed:", error);
    return NextResponse.json(
      { error: "Erro ao carregar reuniões." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    meetings: (data ?? []).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      clientName: meeting.client_name,
      createdAt: meeting.created_at,
      status: meeting.status,
    })),
  });
}
