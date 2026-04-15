import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentUserForIdentity } from "@/lib/user/current-user";

function buildCurrentUserIdentity(auth: {
  user: { id: string; email?: string | null };
}) {
  return {
    id: auth.user.id,
    email: auth.user.email ?? null,
  };
}

export const GET = withAuth(async (_request, { auth }) => {
  try {
    return NextResponse.json({
      user: await getCurrentUserForIdentity(buildCurrentUserIdentity(auth)),
    });
  } catch (error) {
    console.error("[user/me] GET failed:", error);
    return NextResponse.json(
      { error: "Erro ao carregar usuário." },
      { status: 500 }
    );
  }
});

export const PATCH = withAuth(async (request, { auth }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const profilePayload: Record<string, string | null> = {};

  if (typeof data.name === "string") {
    profilePayload.name = data.name.trim() || null;
  }

  if (typeof data.company === "string") {
    profilePayload.company = data.company.trim() || null;
  }

  if (typeof data.whatsappNumber === "string" || data.whatsappNumber === null) {
    profilePayload.whatsapp_number =
      typeof data.whatsappNumber === "string"
        ? data.whatsappNumber.trim() || null
        : null;
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: auth.user.id,
        ...profilePayload,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("[user/me] PATCH failed:", error);
      return NextResponse.json(
        { error: "Erro ao atualizar usuário." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: await getCurrentUserForIdentity(buildCurrentUserIdentity(auth)),
    });
  } catch (error) {
    console.error("[user/me] PATCH unexpected failure:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar usuário." },
      { status: 500 }
    );
  }
});
