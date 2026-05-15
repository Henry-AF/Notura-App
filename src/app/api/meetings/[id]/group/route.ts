import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, withAuth } from "@/lib/api/auth";

function readGroupId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Grupo invalido.");
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export const PATCH = withAuth<{ id: string }, NextRequest>(async (
  request: NextRequest,
  { params, auth }
) => {
  try {
    const body = (await request.json()) as { groupId?: unknown };
    const groupId = readGroupId(body.groupId);

    await requireOwnership(
      auth.supabaseAdmin,
      "meetings",
      params.id,
      auth.user.id
    );

    if (groupId) {
      await requireOwnership(
        auth.supabaseAdmin,
        "meeting_groups",
        groupId,
        auth.user.id
      );
    }

    const { error } = await auth.supabaseAdmin
      .from("meetings")
      .update({ group_id: groupId })
      .eq("id", params.id);

    if (error) {
      throw new Error("Erro ao atualizar grupo da reuniao.");
    }

    return NextResponse.json({ meetingId: params.id, groupId });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Body JSON invalido." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Grupo invalido." },
      { status: 400 }
    );
  }
});
