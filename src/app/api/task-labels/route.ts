import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const GET = withAuth(async (_request, { auth }) => {
  const supabase = createServiceRoleClient();
  const { data: labels, error } = await supabase
    .from("task_labels")
    .select("id, name, color, created_at")
    .eq("user_id", auth.user.id)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: "Erro ao buscar labels." }, { status: 500 });

  return NextResponse.json({ labels: labels ?? [] });
});

export const POST = withAuth(async (request, { auth }) => {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 }); }

  const data = body as Record<string, unknown>;

  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    return NextResponse.json({ error: "Campo 'name' é obrigatório." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: label, error } = await supabase
    .from("task_labels")
    .insert({
      user_id: auth.user.id,
      name: data.name.trim(),
      color: typeof data.color === "string" ? data.color : "#6C5CE7",
    })
    .select("id, name, color, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe um label com esse nome." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao criar label." }, { status: 500 });
  }

  return NextResponse.json({ label }, { status: 201 });
});
