"use client";

import React, { useState } from "react";
import { LogOut } from "lucide-react";

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
  onConnect: (id: string) => void;
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
          background: "#1C1C1C",
          borderColor: "#3A3A3A",
          width: "360px",
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-display text-base font-bold text-white">
          Desconectar {name}?
        </h3>
        <p className="mt-2 text-[13px] text-[#A0A0A0]">
          Você não receberá mais resumos neste número após desconectar.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#3A3A3A] py-2.5 text-sm font-medium text-[#A0A0A0] transition-colors hover:border-[#555] hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors"
            style={{ background: "#FF6B6B" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,107,107,0.85)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "#FF6B6B")
            }
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
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const confirmTarget = integrations.find((i) => i.id === confirmId);

  return (
    <>
      <div
        className="rounded-2xl border p-6"
        style={{ background: "#1C1C1C", borderColor: "#2E2E2E" }}
      >
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center gap-4"
            >
              {/* Icon */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ background: "#0A3D1F" }}
              >
                <span style={{ color: "#25D366" }}>{integration.icon}</span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-white">
                  {integration.name}
                </p>
                {integration.phone && (
                  <p className="text-[13px] text-[#A0A0A0]">
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#3A3A3A] text-[#A0A0A0] transition-colors hover:border-[#FF6B6B] hover:text-[#FF6B6B]"
                  style={{ background: "transparent" }}
                  aria-label={`Desconectar ${integration.name}`}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onConnect(integration.id)}
                  className="rounded-lg border border-[#3A3A3A] px-3 py-1.5 text-xs font-medium text-[#A0A0A0] transition-colors hover:border-[#6851FF] hover:text-[#6851FF]"
                  style={{ background: "transparent" }}
                >
                  Conectar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

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
