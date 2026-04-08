"use client";

import React, { useState } from "react";
import { LogOut, Phone } from "lucide-react";
import { useThemeColors } from "@/lib/theme-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Integration {
  id: string;
  name: string;
  icon: string;
  phone?: string;
  status: "connected" | "disconnected";
}

export interface IntegrationsCardProps {
  integrations: Integration[];
  onDisconnect: (id: string) => void;
  onConnect: (id: string, phone: string) => void;
}

// ─── BR phone mask helpers ────────────────────────────────────────────────────

/**
 * Strips non-digits then applies  +55 (XX) XXXXX-XXXX  mask.
 * Accepts 10 digits (landline) or 11 digits (mobile).
 */
function formatBRPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `+55 (${digits}`;
  if (digits.length <= 7) return `+55 (${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function extractDigits(masked: string): string {
  return masked.replace(/\D/g, "");
}

function isPhoneComplete(digits: string): boolean {
  // Brazilian mobile: DDD (2) + 9 digits = 11 total
  // Brazilian landline: DDD (2) + 8 digits = 10 total
  return digits.length === 11 || digits.length === 10;
}

// ─── Phone connect modal ──────────────────────────────────────────────────────

function PhoneConnectModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (phone: string) => void;
}) {
  const c = useThemeColors();
  const [masked, setMasked] = useState("");
  const digits = extractDigits(masked);
  const complete = isPhoneComplete(digits);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const allDigits = e.target.value.replace(/\D/g, "");
    // The mask always begins with "+55 ...", so when the input re-fires its own
    // masked value, the digits string already has "55" prepended from the country
    // code. Strip those two prefix digits before reformatting so the user's
    // actual DDD+number is preserved correctly.
    const userDigits =
      e.target.value.includes("+55") && allDigits.startsWith("55")
        ? allDigits.slice(2)
        : allDigits;
    setMasked(formatBRPhone(userDigits));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border p-7"
        style={{
          background: c.card,
          borderColor: c.border,
          width: "380px",
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "#0A3D1F" }}
        >
          <Phone className="h-6 w-6" style={{ color: "#25D366" }} />
        </div>
        <h3 className="font-display text-base font-bold" style={{ color: c.ink }}>
          Conectar WhatsApp
        </h3>
        <p className="mt-1.5 text-[13px]" style={{ color: c.ink2 }}>
          Digite o número com DDD. Você receberá os resumos das reuniões neste
          número.
        </p>

        <div className="mt-5">
          <label
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: c.ink3 }}
          >
            Número WhatsApp
          </label>
          <input
            autoFocus
            type="tel"
            value={masked}
            onChange={handleChange}
            placeholder="+55 (11) 99999-9999"
            className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#25D366]"
            style={{
              background: c.inputBg,
              borderColor: c.inputBorder,
              color: c.ink,
            }}
          />
          {masked.length > 0 && !complete && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "#FF6B6B" }}>
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "#FF6B6B" }}
              >
                !
              </span>
              Número incompleto
            </p>
          )}
          {complete && (
            <p className="mt-1.5 text-[12px]" style={{ color: "#4ECB71" }}>
              ✓ Número válido
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors"
            style={{ borderColor: c.border, color: c.ink2, background: "transparent" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => complete && onConfirm(masked)}
            disabled={!complete}
            className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ background: "#25D366" }}
          >
            Conectar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Disconnect confirm modal ─────────────────────────────────────────────────

function DisconnectModal({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const c = useThemeColors();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border p-7"
        style={{
          background: c.card,
          borderColor: c.border,
          width: "360px",
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3
          className="font-display text-base font-bold"
          style={{ color: c.ink }}
        >
          Desconectar {name}?
        </h3>
        <p className="mt-2 text-[13px]" style={{ color: c.ink2 }}>
          Você não receberá mais resumos neste número após desconectar.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors"
            style={{ borderColor: c.border, color: c.ink2, background: "transparent" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors"
            style={{ background: "#FF6B6B" }}
          >
            Desconectar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IntegrationsCard({
  integrations,
  onDisconnect,
  onConnect,
}: IntegrationsCardProps) {
  const c = useThemeColors();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [connectId, setConnectId] = useState<string | null>(null);

  const confirmTarget = integrations.find((i) => i.id === confirmId);
  const connectTarget = integrations.find((i) => i.id === connectId);

  return (
    <>
      <div
        className="rounded-2xl border p-6"
        style={{ background: c.card, borderColor: c.border }}
      >
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="flex items-center gap-4">
              {/* Icon */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ background: "#0A3D1F" }}
              >
                <span style={{ color: "#25D366" }}>{integration.icon}</span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold" style={{ color: c.ink }}>
                  {integration.name}
                </p>
                {integration.phone && (
                  <p className="text-[13px]" style={{ color: c.ink2 }}>
                    {integration.phone}
                  </p>
                )}
                {integration.status === "connected" && (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{ background: "#4ECB71" }}
                    />
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#4ECB71",
                      }}
                    >
                      Conectado
                    </span>
                  </div>
                )}
              </div>

              {/* Action button */}
              {integration.status === "connected" ? (
                <button
                  type="button"
                  onClick={() => setConfirmId(integration.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors hover:border-[#FF6B6B] hover:text-[#FF6B6B]"
                  style={{
                    background: "transparent",
                    borderColor: c.border,
                    color: c.ink2,
                  }}
                  aria-label={`Desconectar ${integration.name}`}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConnectId(integration.id)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-[#6851FF] hover:text-[#6851FF]"
                  style={{
                    background: "transparent",
                    borderColor: c.border,
                    color: c.ink2,
                  }}
                >
                  Conectar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {connectTarget && (
        <PhoneConnectModal
          onClose={() => setConnectId(null)}
          onConfirm={(phone) => {
            onConnect(connectTarget.id, phone);
            setConnectId(null);
          }}
        />
      )}

      {confirmTarget && (
        <DisconnectModal
          name={confirmTarget.name}
          onClose={() => setConfirmId(null)}
          onConfirm={() => {
            onDisconnect(confirmTarget.id);
            setConfirmId(null);
          }}
        />
      )}
    </>
  );
}
