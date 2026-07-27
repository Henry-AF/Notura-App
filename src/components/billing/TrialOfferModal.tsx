"use client";

import React, { useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { useThemeColors } from "@/lib/theme-context";
import {
  dismissTrialOffer,
  startTrialCheckout,
} from "@/lib/billing/trial-offer-client";

export interface TrialOfferModalProps {
  onClose: () => void;
}

const TRIAL_BENEFITS = [
  "7 dias de acesso completo ao plano Pro",
  "Cobramos apenas no dia 8, sem compromisso",
  "Cancele quando quiser antes disso e não pagamos nada",
];

export function TrialOfferModal({ onClose }: TrialOfferModalProps) {
  const c = useThemeColors();
  const [starting, setStarting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartTrial() {
    setStarting(true);
    setError(null);

    try {
      await startTrialCheckout();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente."
      );
      setStarting(false);
    }
  }

  async function handleSkip() {
    setDismissing(true);

    try {
      await dismissTrialOffer();
    } catch {
      // Dismissal is best-effort; still close the modal for the user.
    } finally {
      setDismissing(false);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={() => void handleSkip()}
    >
      <div
        className="relative w-full rounded-t-3xl sm:max-w-md sm:rounded-2xl"
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          boxShadow: "0 22px 70px rgba(0,0,0,0.35)",
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Experimente o plano Pro grátis por 7 dias"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => void handleSkip()}
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full transition-colors"
          style={{ background: c.card2, color: c.ink3 }}
        >
          <X className="size-4" />
        </button>

        <div className="p-6 sm:p-7">
          <div
            className="flex size-11 items-center justify-center rounded-xl"
            style={{ background: "rgba(104,81,255,0.15)" }}
          >
            <Sparkles className="size-5" style={{ color: "#6851FF" }} />
          </div>

          <h2
            className="mt-4 font-display text-xl font-bold"
            style={{ color: c.ink }}
          >
            Experimente o Pro grátis por 7 dias
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: c.ink2 }}>
            Adicione seu cartão para desbloquear o plano Pro agora. Cobramos
            apenas no dia 8, sem compromisso — cancele quando quiser antes disso.
          </p>

          <ul className="mt-5 space-y-2.5">
            {TRIAL_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: "#4ECB71" }}
                />
                <span className="text-sm leading-snug" style={{ color: c.ink2 }}>
                  {benefit}
                </span>
              </li>
            ))}
          </ul>

          {error ? (
            <div
              className="mt-4 rounded-xl px-4 py-2 text-sm"
              style={{
                background: "rgba(255,107,107,0.1)",
                border: "1px solid rgba(255,107,107,0.25)",
                color: "#FF6B6B",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            disabled={starting}
            onClick={() => void handleStartTrial()}
            className="mt-5 w-full rounded-full py-3 font-display text-sm font-bold text-white transition-colors active:scale-[0.98] disabled:opacity-60"
            style={{ background: "#6851FF" }}
          >
            {starting ? "Preparando checkout..." : "Iniciar teste grátis de 7 dias"}
          </button>

          <button
            type="button"
            disabled={dismissing}
            onClick={() => void handleSkip()}
            className="mt-2.5 w-full rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
            style={{ color: c.ink3 }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
