"use client";

import React from "react";
import { WhatsAppCopyButton } from "./WhatsAppCopyButton";
import { SectionCard } from "@/components/ui/app";

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      nodes.push(<br key={`line-break-${index}`} />);
      return;
    }

    if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
      const content = trimmed.replace(/^[•\-]\s*/, "");
      nodes.push(
        <div key={`list-${index}`} className="mb-1.5 flex gap-2">
          <span className="mt-0.5 shrink-0 text-primary">•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      return;
    }

    if (trimmed.endsWith(":") && !trimmed.includes("**")) {
      nodes.push(
        <p
          key={`heading-${index}`}
          className="mb-1.5 mt-4 text-sm font-semibold text-foreground"
        >
          {trimmed}
        </p>
      );
      return;
    }

    nodes.push(
      <p key={`paragraph-${index}`} className="mb-1 text-sm leading-relaxed text-muted-foreground">
        {renderInline(line)}
      </p>
    );
  });

  return nodes;
}

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
    <SectionCard
      title="Resumo Inteligente"
      actions={<WhatsAppCopyButton text={summary} onCopy={onCopyToWhatsApp} />}
      className="rounded-xl"
    >
      <div className="rounded-lg bg-background/70 p-5">
        <div className="text-sm text-muted-foreground">{renderMarkdown(summary)}</div>

        {nextSteps ? (
          <>
            <p className="mb-2 mt-4 text-sm font-semibold text-foreground">Proximos passos:</p>
            <blockquote className="rounded-r-md border-l-2 border-primary bg-primary/10 px-4 py-3 text-sm italic leading-relaxed text-muted-foreground">
              &ldquo;{nextSteps}&rdquo;
            </blockquote>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-2 border-t pt-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          AI
        </div>
        <span className="text-xs italic text-muted-foreground">
          Este resumo foi gerado automaticamente pela Inteligencia Notura. Revise antes de compartilhar.
          {generatedAt ? ` • ${generatedAt}` : ""}
        </span>
      </div>
    </SectionCard>
  );
}
