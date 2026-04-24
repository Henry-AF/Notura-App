import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import {
  DashboardOverviewLoadError,
  getDashboardOverviewForIdentity,
} from "@/lib/dashboard/overview";

export const GET = withAuth(async (_request, { auth }) => {
  try {
    const overview = await getDashboardOverviewForIdentity({
      id: auth.user.id,
      email: auth.user.email ?? null,
    });
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof DashboardOverviewLoadError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error("[dashboard/overview] unknown failure:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dashboard." },
      { status: 500 }
    );
  }
});
