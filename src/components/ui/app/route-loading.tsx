import { Loader2 } from "lucide-react";
import { PageShell } from "./page-shell";

interface RouteLoadingProps {
  label?: string;
  withPageShell?: boolean;
}

function RouteLoadingContent() {
  return (
    <div className="flex h-full min-h-[40vh] flex-1 items-center justify-center">
      <Loader2 className="size-7 animate-spin text-primary" />
    </div>
  );
}

export function RouteLoading({ withPageShell = false }: RouteLoadingProps) {
  if (withPageShell) {
    return (
      <PageShell>
        <RouteLoadingContent />
      </PageShell>
    );
  }

  return <RouteLoadingContent />;
}
