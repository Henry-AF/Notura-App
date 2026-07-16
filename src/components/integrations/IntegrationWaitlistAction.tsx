"use client";

import { Bell, CheckCircle2 } from "lucide-react";
import type { IntegrationChannel } from "@/lib/integrations/integration-interest";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntegrationWaitlistActionProps {
  channel: IntegrationChannel;
  registered: boolean;
  pending: boolean;
  onRegister: (channel: IntegrationChannel) => void;
  /**
   * "compact" renders an inline chip button suited for list rows (Settings).
   * "block" renders a full-width button suited for grid cards (Contacts).
   */
  variant?: "compact" | "block";
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shared call-to-action for "coming soon" integrations. Renders a confirmed
 * state (already registered) or a button that registers interest through the
 * `/api/integration-interest` endpoint. Used by both Settings and Contacts.
 */
export function IntegrationWaitlistAction({
  channel,
  registered,
  pending,
  onRegister,
  variant = "compact",
}: IntegrationWaitlistActionProps) {
  if (registered) {
    return variant === "block" ? (
      <div className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-notura-success/30 bg-notura-success/10 px-4 py-2 text-sm font-medium text-notura-success">
        <CheckCircle2 className="size-4" />
        Você será avisado
      </div>
    ) : (
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-notura-success/15 px-2.5 py-1 text-xs font-medium text-notura-success">
          Você será avisado
        </span>
        <span className="rounded-full bg-notura-surface-2 px-2.5 py-1 text-xs font-medium text-notura-ink-secondary">
          Em breve
        </span>
      </div>
    );
  }

  const buttonStyle = {
    background: "rgba(83,65,205,0.12)",
    color: "#5E4CEB",
    transitionTimingFunction: "cubic-bezier(0.3, 0, 0.1, 1)",
  };

  if (variant === "block") {
    return (
      <button
        type="button"
        onClick={() => onRegister(channel)}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-transform duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
        style={buttonStyle}
      >
        <Bell className="size-4" />
        {pending ? "Enviando..." : "Quero ser avisado"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onRegister(channel)}
      disabled={pending}
      className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-transform duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
      style={buttonStyle}
    >
      {pending ? "Enviando..." : "Quero ser avisado"}
    </button>
  );
}
