import { NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const DELETE = withAuth<{ id: string }>(async (_req, { params, auth }) => {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Label ID obrigatório." }, { status: 400 });

  const supabase = createServiceRoleClient();
  await requireOwnership(supabase, "task_labels", id, auth.user.id);

  const { error } = await supabase.from("task_labels").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Erro ao excluir label." }, { status: 500 });

  return NextResponse.json({ success: true });
});
