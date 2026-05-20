"use client";

import { getBillingCycleDisplayName, ANNUAL_SAVINGS_LABEL, type BillingCycle } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface PricingToggleProps {
  billingCycle: BillingCycle;
  onChange: (value: BillingCycle) => void;
  className?: string;
}

export function PricingToggle({ billingCycle, onChange, className }: PricingToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background p-1 shadow-sm",
        className
      )}
      role="tablist"
      aria-label="Ciclo de cobrança"
    >
      <ToggleButton
        active={billingCycle === "monthly"}
        label={getBillingCycleDisplayName("monthly")}
        onClick={() => onChange("monthly")}
      />
      <ToggleButton
        active={billingCycle === "yearly"}
        label={`${getBillingCycleDisplayName("yearly")} — ${ANNUAL_SAVINGS_LABEL}`}
        onClick={() => onChange("yearly")}
      />
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-notura-primary text-white shadow-sm"
          : "text-notura-secondary hover:text-notura-ink"
      )}
    >
      {label}
    </button>
  );
}