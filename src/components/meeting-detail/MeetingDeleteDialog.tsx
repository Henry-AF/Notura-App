"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Trash2, X } from "lucide-react";
import { useThemeColors } from "@/lib/theme-context";

const DELETE_CONFIRMATION_TEXT = "Confirmar";

export interface MeetingDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingName: string;
  summary: string;
  isDeleting?: boolean;
  onConfirmDelete: () => void | Promise<void>;
  onCopySummary?: () => void;
}

export function MeetingDeleteDialog({
  open,
  onOpenChange,
  meetingName,
  summary,
  isDeleting = false,
  onConfirmDelete,
  onCopySummary,
}: MeetingDeleteDialogProps) {
  const c = useThemeColors();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [confirmationValue, setConfirmationValue] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmationValue("");
      setCopied(false);
    } else {
      // Focus the input after the animation settles
      const t = window.setTimeout(() => inputRef.current?.focus(), 300);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const canDelete = useMemo(
    () => confirmationValue.trim() === DELETE_CONFIRMATION_TEXT,
    [confirmationValue]
  );

  const hasSummary = summary.trim().length > 0;

  async function handleCopySummary() {
    if (!hasSummary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      onCopySummary?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopySummary?.();
    }
  }

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes deleteModalSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes deleteModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .delete-modal-panel {
          animation: deleteModalSlideUp 0.32s cubic-bezier(0.3, 0, 0.1, 1) both;
        }
        @media (min-width: 640px) {
          .delete-modal-panel {
            animation: deleteModalIn 0.25s cubic-bezier(0.3, 0, 0.1, 1) both;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={() => onOpenChange(false)}
        role="presentation"
      >
        {/* Panel */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Excluir reunião"
          className="delete-modal-panel relative w-full rounded-t-[38px] sm:max-w-md sm:rounded-[22px]"
          style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            maxHeight: "92dvh",
            overflowY: "auto",
            boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle — mobile only */}
          <div
            className="mx-auto mb-2 mt-3 h-1 w-10 shrink-0 rounded-full sm:hidden"
            style={{ background: c.border }}
          />

          {/* Header */}
          <div className="flex items-start justify-between px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
            <div className="flex items-center gap-3">
              {/* Warning icon */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
                style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2
                  className="font-display text-[17px] font-semibold leading-tight tracking-[-0.01em]"
                  style={{ color: c.ink }}
                >
                  Excluir reunião?
                </h2>
                <p className="mt-0.5 text-[13px]" style={{ color: c.ink2 }}>
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
              style={{ background: c.card2, color: c.ink2 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-4 px-5 pb-6 sm:px-6">
            {/* Description */}
            <p className="text-[14px] leading-relaxed" style={{ color: c.ink2 }}>
              A reunião{" "}
              <span className="font-semibold" style={{ color: c.ink }}>
                {meetingName}
              </span>
              , todo o conteúdo gerado e o arquivo de áudio associado serão
              removidos permanentemente.
            </p>

            {/* Copy summary box */}
            <div
              className="rounded-[14px] p-4"
              style={{
                background: c.card2,
                border: `1px solid ${c.border}`,
              }}
            >
              <p className="text-[13px] font-semibold" style={{ color: c.ink }}>
                Salve o resumo antes
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: c.ink2 }}>
                Copie o resumo inteligente agora para não perder o conteúdo já
                gerado.
              </p>
              <button
                type="button"
                onClick={() => { void handleCopySummary(); }}
                disabled={!hasSummary}
                className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[10px] text-[13px] font-medium transition-all active:scale-95 disabled:opacity-40 sm:w-auto sm:px-4"
                style={{
                  background: "rgba(83,65,205,0.1)",
                  color: "#5341CD",
                  transition: "background 0.18s, transform 0.15s cubic-bezier(0.3,0,0.1,1)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(83,65,205,0.16)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(83,65,205,0.1)";
                }}
              >
                {copied
                  ? <Check className="h-3.5 w-3.5" />
                  : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Resumo copiado!" : "Copiar resumo inteligente"}
              </button>
              {!hasSummary && (
                <p className="mt-2 text-[11px]" style={{ color: c.ink2 }}>
                  Esta reunião ainda não possui resumo disponível.
                </p>
              )}
            </div>

            {/* Confirmation input */}
            <div className="space-y-2">
              <label
                htmlFor="meeting-delete-confirmation"
                className="text-[13px] font-medium"
                style={{ color: c.ink }}
              >
                Digite{" "}
                <span className="font-bold" style={{ color: "#EF4444" }}>
                  Confirmar
                </span>{" "}
                para continuar
              </label>
              <input
                ref={inputRef}
                id="meeting-delete-confirmation"
                type="text"
                value={confirmationValue}
                onChange={(e) => setConfirmationValue(e.target.value)}
                placeholder="Confirmar"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 w-full rounded-[14px] px-4 text-[14px] outline-none transition-shadow focus:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                style={{
                  background: c.card2,
                  border: `1px solid ${c.border}`,
                  color: c.ink,
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => { void onConfirmDelete(); }}
                disabled={!canDelete || isDeleting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold text-white transition-all active:scale-95 disabled:opacity-40 sm:flex-1"
                style={{
                  background: canDelete && !isDeleting ? "#EF4444" : "rgba(239,68,68,0.5)",
                  boxShadow: canDelete && !isDeleting ? "0 4px 14px rgba(239,68,68,0.35)" : "none",
                  transition: "background 0.2s, box-shadow 0.2s, transform 0.15s cubic-bezier(0.3,0,0.1,1)",
                }}
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Excluindo..." : "Excluir reunião"}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isDeleting}
                className="flex h-11 w-full items-center justify-center rounded-[14px] text-[15px] font-medium transition-all active:scale-95 sm:flex-1"
                style={{
                  background: c.card2,
                  color: c.ink,
                  border: `1px solid ${c.border}`,
                  transition: "opacity 0.15s, transform 0.15s cubic-bezier(0.3,0,0.1,1)",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
