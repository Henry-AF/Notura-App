"use client";

import React, { useState, useCallback } from "react";
import { Clipboard, Check } from "lucide-react";

export interface WhatsAppCopyButtonProps {
  text: string;
  label?: string;
  onCopy?: () => void;
}

export function WhatsAppCopyButton({
  text,
  label = "Copiar para WhatsApp",
  onCopy,
}: WhatsAppCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for environments without clipboard API
    }
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  }, [text, onCopy]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copiado!" : label}
      className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-medium transition-opacity hover:opacity-75"
      style={{ color: "#5341CD" }}
    >
      {copied ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <Clipboard className="size-3.5 shrink-0" />
      )}
      {copied ? "Copiado!" : label}
    </button>
  );
}
