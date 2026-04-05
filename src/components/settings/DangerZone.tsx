"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

// ─── ConfirmDeleteModal ───────────────────────────────────────────────────────

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmDeleteModal({ isOpen, onClose, onConfirm }: ConfirmDeleteModalProps) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canDelete = typed === "DELETAR";

  useEffect(() => {
    if (isOpen) {
      setTyped("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!isOpen) return null;

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
          width: "420px",
          maxWidth: "90vw",
          transform: "scale(1)",
          animation: "modalIn 0.15s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Icon */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "rgba(255,107,107,0.12)" }}
        >
          <AlertTriangle className="h-6 w-6" style={{ color: "#FF6B6B" }} />
        </div>

        {/* Title */}
        <h2
          id="delete-modal-title"
          className="mt-4 font-display text-lg font-bold text-white"
        >
          Tem certeza absoluta?
        </h2>
        <p className="mt-1.5 text-[13px] text-[#A0A0A0]">
          Esta ação é irreversível. Todos os dados serão permanentemente
          removidos.
        </p>

        {/* Confirmation input */}
        <div className="mt-5">
          <label className="mb-2 block text-[11px] font-semibold text-[#606060]">
            Digite{" "}
            <span className="font-mono text-[#FF6B6B]">DELETAR</span> para
            confirmar:
          </label>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETAR"
            className="w-full rounded-lg border border-[#3A3A3A] bg-[#242424] px-3.5 py-2.5 text-sm text-white outline-none placeholder-[#606060] focus:border-[#FF6B6B]"
          />
        </div>

        {/* Buttons */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#3A3A3A] py-2.5 text-sm font-medium text-[#A0A0A0] transition-colors hover:border-[#555] hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={onConfirm}
            className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: canDelete ? "#FF6B6B" : "#3A3A3A" }}
          >
            Excluir permanentemente
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── DangerZone ───────────────────────────────────────────────────────────────

interface DangerZoneProps {
  onDeleteAccount: () => Promise<void>;
}

export function DangerZone({ onDeleteAccount }: DangerZoneProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onDeleteAccount();
    } finally {
      setDeleting(false);
      setModalOpen(false);
    }
  };

  return (
    <>
      <div
        className="flex flex-col items-start justify-between gap-4 rounded-xl border p-[18px_24px] sm:flex-row sm:items-center"
        style={{ background: "#1A0A0A", borderColor: "#3A1010" }}
      >
        {/* Left: icon + text */}
        <div className="flex items-start gap-3 sm:items-center">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "rgba(255,107,107,0.12)" }}
          >
            <AlertTriangle className="h-4.5 w-4.5" style={{ color: "#FFA94D" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#FF6B6B" }}>
              Zona de Perigo
            </p>
            <p className="text-[13px] text-[#A0A0A0]">
              Excluir sua conta removerá todos os dados de reuniões
              permanentemente.
            </p>
          </div>
        </div>

        {/* Right: button */}
        <button
          type="button"
          disabled={deleting}
          onClick={() => setModalOpen(true)}
          className="w-full shrink-0 rounded-lg border px-[18px] py-2 text-[13px] font-semibold transition-colors sm:w-auto"
          style={{
            background: "transparent",
            borderColor: "#FF6B6B",
            color: "#FF6B6B",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,107,107,0.1)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              "transparent")
          }
        >
          {deleting ? "Excluindo..." : "Excluir Conta"}
        </button>
      </div>

      <ConfirmDeleteModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
