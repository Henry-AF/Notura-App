"use client";

import { useRouter } from "next/navigation";
import { DemoResult, FunnelLayout } from "@/components/onboarding-funnel";
import { Button } from "@/components/ui/button";
import { DEMO_MEETING } from "@/lib/onboarding-funnel/demo-meeting";

/** Standalone replay of the demo meeting, reachable from inside the app ("Ver novamente a demonstração"). */
export default function DemoReplayPage() {
  const router = useRouter();

  return (
    <FunnelLayout progress={100} canGoBack onBack={() => router.back()} wide>
      <div className="space-y-6">
        <DemoResult meeting={DEMO_MEETING} />
        <Button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="h-12 w-full rounded-lg"
        >
          Começar minha primeira reunião
        </Button>
      </div>
    </FunnelLayout>
  );
}
