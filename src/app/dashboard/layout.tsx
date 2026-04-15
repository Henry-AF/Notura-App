import { redirect } from "next/navigation";
import { ThemeProvider } from "@/lib/theme-context";
import { getCurrentUserFromRequest } from "@/lib/user/current-user";
import { DashboardLayoutClient } from "./dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUserFromRequest();

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <ThemeProvider>
      <DashboardLayoutClient initialUser={currentUser}>
        {children}
      </DashboardLayoutClient>
    </ThemeProvider>
  );
}
