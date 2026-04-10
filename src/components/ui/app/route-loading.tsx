import { LoadingState } from "./loading-state";
import { PageShell } from "./page-shell";
import { SectionCard } from "./section-card";

interface RouteLoadingProps {
  label?: string;
  withPageShell?: boolean;
}

function RouteLoadingContent({ label }: { label: string }) {
  return (
    <SectionCard className="rounded-xl border-0 bg-transparent p-0">
      <LoadingState label={label} className="min-h-[220px]" />
    </SectionCard>
  );
}

export function RouteLoading({
  label = "Carregando...",
  withPageShell = false,
}: RouteLoadingProps) {
  if (withPageShell) {
    return (
      <PageShell>
        <RouteLoadingContent label={label} />
      </PageShell>
    );
  }

  return <RouteLoadingContent label={label} />;
}
