"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type MeetingTab = "summary" | "transcript" | "tasks" | "decisions" | "pending";

export interface MeetingTabsProps {
  activeTab: MeetingTab;
  onChange: (tab: MeetingTab) => void;
}

const TABS: Array<{ key: MeetingTab; label: string }> = [
  { key: "summary",    label: "Resumo" },
  { key: "transcript", label: "Transcrição" },
  { key: "tasks",      label: "Tarefas" },
  { key: "decisions",  label: "Decisões" },
  { key: "pending",    label: "Pendências" },
];

export function MeetingTabs({ activeTab, onChange }: MeetingTabsProps) {
  return (
    <div className="mb-5 border-b border-border/50">
      <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-selected={active}
              role="tab"
              className={cn(
                "relative flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/75"
              )}
            >
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
