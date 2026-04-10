import { ToastProvider } from "@/components/upload/Toast";
import { fetchDashboardOverview } from "./dashboard-api";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const overview = await fetchDashboardOverview();

  return (
    <ToastProvider>
      <DashboardClient initialOverview={overview} />
    </ToastProvider>
  );
}
