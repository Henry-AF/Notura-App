import { NextResponse } from "next/server";
import {
  DashboardOverviewLoadError,
  DashboardUnauthorizedError,
  getDashboardOverview,
} from "@/lib/dashboard/overview";

export async function GET() {
  try {
    const overview = await getDashboardOverview();
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof DashboardUnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof DashboardOverviewLoadError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error("[dashboard/overview] unknown failure:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dashboard." },
      { status: 500 }
    );
  }
}
