"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [confirmationValue, setConfirmationValue] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmationValue("");
      setCopied(false);
    }
  }, [open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-2xl p-0 sm:rounded-3xl">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold text-foreground">
              Excluir esta reuniao?
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              Esta e uma operacao sem volta. Ao continuar, a reuniao{" "}
              <span className="font-medium text-foreground">{meetingName}</span>, o
              conteudo gerado e o arquivo mp4 associado serao removidos
              permanentemente.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">
              Antes de apagar tudo
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Copie o resumo inteligente agora para nao perder o conteudo ja
              gerado.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void handleCopySummary();
              }}
              disabled={!hasSummary}
              className="mt-4 h-10 w-full justify-center rounded-xl sm:w-auto"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Resumo copiado" : "Copiar resumo inteligente"}
            </Button>
            {!hasSummary ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Esta reuniao ainda nao possui resumo inteligente disponivel.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="meeting-delete-confirmation"
              className="text-sm font-medium text-foreground"
            >
              Digite <span className="font-semibold text-destructive">Confirmar</span> para seguir
            </label>
            <Input
              id="meeting-delete-confirmation"
              value={confirmationValue}
              onChange={(event) => setConfirmationValue(event.target.value)}
              placeholder="Confirmar"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 rounded-xl"
            />
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
              className="h-11 w-full rounded-xl sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                void onConfirmDelete();
              }}
              disabled={!canDelete || isDeleting}
              className="h-11 w-full rounded-xl sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Excluindo reuniao..." : "Excluir reuniao"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
