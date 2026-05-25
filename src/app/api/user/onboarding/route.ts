import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import {
  getUserOnboardingState,
  updateUserOnboardingState,
  type UpdateUserOnboardingInput,
} from "@/lib/user/onboarding";

function isValidPhase(value: unknown): value is 0 | 1 | 2 {
  return value === 0 || value === 1 || value === 2;
}

export const GET = withAuth(async (_request, { auth }) => {
  try {
    return NextResponse.json({
      onboarding: await getUserOnboardingState(auth.user.id),
    });
  } catch (error) {
    console.error("[user/onboarding] GET failed:", error);
    return NextResponse.json(
      { error: "Erro ao carregar onboarding." },
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
  const payload: UpdateUserOnboardingInput = {};

  if (data.onboardingCompleted !== undefined) {
    if (typeof data.onboardingCompleted !== "boolean") {
      return NextResponse.json(
        { error: "onboardingCompleted deve ser boolean." },
        { status: 400 }
      );
    }

    payload.onboardingCompleted = data.onboardingCompleted;
  }

  if (data.onboardingPhase !== undefined) {
    if (!isValidPhase(data.onboardingPhase)) {
      return NextResponse.json(
        { error: "onboardingPhase deve ser 0, 1 ou 2." },
        { status: 400 }
      );
    }

    payload.onboardingPhase = data.onboardingPhase;
  }

  if (
    payload.onboardingCompleted === undefined &&
    payload.onboardingPhase === undefined
  ) {
    return NextResponse.json(
      { error: "Nenhum campo de onboarding foi informado." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({
      onboarding: await updateUserOnboardingState(auth.user.id, payload),
    });
  } catch (error) {
    console.error("[user/onboarding] PATCH failed:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar onboarding." },
      { status: 500 }
    );
  }
});
