"use client";

import React from "react";
import { WhatsAppCopyButton } from "./WhatsAppCopyButton";

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.trim() === "") {
      nodes.push(<br key={`br-${i}`} />);
      return;
    }

    // List item
    if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
      const content = line.trim().replace(/^[•\-]\s*/, "");
      nodes.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <span style={{ color: "#6C5CE7", marginTop: 2, flexShrink: 0 }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      return;
    }

    // Section header (line ending with ":")
    if (line.trim().endsWith(":") && !line.includes("**")) {
      nodes.push(
        <p
          key={i}
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "rgb(var(--cn-ink))",
            marginTop: 16,
            marginBottom: 6,
          }}
        >
          {line.trim()}
        </p>
      );
      return;
    }

    nodes.push(
      <p key={i} style={{ margin: "0 0 4px" }}>
        {renderInline(line)}
      </p>
    );
  });

  return nodes;
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "rgb(var(--cn-ink))", fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// ─── SmartSummaryCard ─────────────────────────────────────────────────────────

export interface SmartSummaryCardProps {
  summary: string;
  nextSteps?: string;
  generatedAt?: string;
  onCopyToWhatsApp: () => void;
}

export function SmartSummaryCard({
  summary,
  nextSteps,
  generatedAt,
  onCopyToWhatsApp,
}: SmartSummaryCardProps) {
  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 14,
        padding: 24,
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, color: "#6C5CE7" }}>✦</span>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "rgb(var(--cn-ink))",
            }}
          >
            Resumo Inteligente
          </span>
        </div>
        <WhatsAppCopyButton text={summary} onCopy={onCopyToWhatsApp} />
      </div>

      {/* Summary body */}
      <div
        style={{
          background: "rgb(var(--cn-bg))",
          borderRadius: 10,
          padding: 20,
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: 14,
          color: "rgb(var(--cn-ink2))",
          lineHeight: 1.7,
        }}
      >
        {renderMarkdown(summary)}

        {/* Próximos Passos blockquote */}
        {nextSteps && (
          <>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: "rgb(var(--cn-ink))",
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              Próximos Passos:
            </p>
            <blockquote
              style={{
                background: "rgba(104,81,255,0.08)",
                borderLeft: "3px solid #6C5CE7",
                borderRadius: "0 8px 8px 0",
                padding: "14px 16px",
                marginTop: 0,
                marginLeft: 0,
                marginRight: 0,
                fontFamily: "Inter, sans-serif",
                fontStyle: "italic",
                fontSize: 13,
                color: "rgb(var(--cn-ink2))",
                lineHeight: 1.6,
              }}
            >
              "{nextSteps}"
            </blockquote>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid rgb(var(--cn-border))",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#6C5CE7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            color: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          AI
        </div>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: "rgb(var(--cn-muted))",
            fontStyle: "italic",
          }}
        >
          Este resumo foi gerado automaticamente pela Inteligência Notura.
          Revise antes de compartilhar.
          {generatedAt ? ` • ${generatedAt}` : ""}
        </span>
      </div>
    </div>
  );
}
