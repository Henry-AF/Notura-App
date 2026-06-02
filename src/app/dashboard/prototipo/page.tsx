import { fetchDashboardOverview } from "@/app/dashboard/dashboard-api";
import { PrototipoClient } from "./prototipo-client";

export const metadata = { title: "Nova Experiência — Notura" };

export default async function PrototipoPage() {
  const overview = await fetchDashboardOverview();
  return <PrototipoClient userName={overview.userName} meetings={overview.meetings} />;
}
