import { redirect } from "next/navigation";
import { ToastProvider } from "@/components/upload/Toast";
import { DashboardUnauthorizedError } from "@/lib/dashboard/overview";
import { fetchDashboardOverview } from "./dashboard-api";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  let overview;

  try {
    overview = await fetchDashboardOverview();
  } catch (error) {
    if (error instanceof DashboardUnauthorizedError) {
      redirect("/login");
    }

    throw error;
  }

  return (
    <ToastProvider>
      <DashboardClient initialOverview={overview} />
    </ToastProvider>
  );
}
