"use client";

import React, { useState, useCallback } from "react";
import { Clipboard, Check } from "lucide-react";

export interface WhatsAppCopyButtonProps {
  text: string;
  onCopy?: () => void;
}

export function WhatsAppCopyButton({ text, onCopy }: WhatsAppCopyButtonProps) {
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
      style={{
        background: copied ? "#1DAA52" : "#25D366",
        color: "#FFFFFF",
        borderRadius: 8,
        padding: "10px 18px",
        fontFamily: "Inter, sans-serif",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: "0.04em",
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "none",
        cursor: "pointer",
        transition: "background 0.15s, transform 0.1s",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!copied)
          (e.currentTarget as HTMLButtonElement).style.background = "#1DAA52";
      }}
      onMouseLeave={(e) => {
        if (!copied)
          (e.currentTarget as HTMLButtonElement).style.background = "#25D366";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {copied ? (
        <Check style={{ width: 14, height: 14 }} />
      ) : (
        <Clipboard style={{ width: 14, height: 14 }} />
      )}
      {copied ? "✓ Copiado!" : "Copiar para WhatsApp"}
    </button>
  );
}
