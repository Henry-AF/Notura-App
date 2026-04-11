import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getBillingStatus } from "@/lib/billing";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

interface AuthenticatedUser {
  id: string;
  email: string | null;
}

function toUserName(name: string | null | undefined, email: string | null) {
  if (name?.trim()) return name.trim();
  if (email?.includes("@")) return email.split("@")[0] ?? "Usuário";
  return "Usuário";
}

async function buildCurrentUserResponse(user: AuthenticatedUser) {
  const supabase = createServiceRoleClient();
  const [profileResult, billingStatus] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, company, whatsapp_number")
      .eq("id", user.id)
      .maybeSingle(),
    getBillingStatus(user.id),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: toUserName(profileResult.data?.name, user.email),
      company: profileResult.data?.company ?? "",
      whatsappNumber: profileResult.data?.whatsapp_number ?? "",
      plan: billingStatus.billingAccount.plan as Plan,
      meetingsThisMonth: billingStatus.meetingsThisMonth,
      monthlyLimit: billingStatus.monthlyLimit,
    },
  };
}

export const GET = withAuth(async (_request, { auth }) => {
  try {
    return NextResponse.json(
      await buildCurrentUserResponse({
        id: auth.user.id,
        email: auth.user.email ?? null,
      })
    );
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

    return NextResponse.json(
      await buildCurrentUserResponse({
        id: auth.user.id,
        email: auth.user.email ?? null,
      })
    );
  } catch (error) {
    console.error("[user/me] PATCH unexpected failure:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar usuário." },
      { status: 500 }
    );
  }
});
