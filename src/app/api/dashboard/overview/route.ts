import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import {
  DashboardOverviewLoadError,
  getDashboardOverview,
} from "@/lib/dashboard/overview";

export const GET = withAuth(async () => {
  try {
    const overview = await getDashboardOverview();
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
