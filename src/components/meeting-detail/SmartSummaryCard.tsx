"use client";

import React from "react";
import { Sparkles } from "lucide-react";
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
        <div key={`list-${index}`} className="mb-2 flex gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
          <span className="leading-relaxed">{renderInline(content)}</span>
        </div>
      );
      return;
    }

    if (trimmed.endsWith(":") && !trimmed.includes("**")) {
      nodes.push(
        <p
          key={`heading-${index}`}
          className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/70"
        >
          {trimmed.replace(/:$/, "")}
        </p>
      );
      return;
    }

    nodes.push(
      <p key={`paragraph-${index}`} className="mb-1.5 text-sm leading-[1.75] text-muted-foreground">
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
    <SectionCard className="rounded-2xl border-border/40">
      {/* AI Header */}
      <div className="mb-5 flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">Resumo Inteligente</p>
            <p className="text-[11px] text-muted-foreground/70">
              Gerado pela Notura AI{generatedAt ? ` · ${generatedAt}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
            IA
          </span>
          <WhatsAppCopyButton text={summary} onCopy={onCopyToWhatsApp} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-prose text-sm text-muted-foreground">
        {renderMarkdown(summary)}
      </div>

      {nextSteps ? (
        <>
          <p className="mb-2.5 mt-6 text-[13px] font-semibold text-foreground">Próximos passos</p>
          <blockquote className="rounded-xl border-l-2 border-primary/40 bg-primary/5 px-4 py-3.5 text-sm italic leading-relaxed text-muted-foreground">
            &ldquo;{nextSteps}&rdquo;
          </blockquote>
        </>
      ) : null}
    </SectionCard>
  );
}
