"use client";

import React from "react";

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
    <div className="mb-6">
      {/* Scrollable pill row — hidden scrollbar, touch-friendly */}
      <div className="flex gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-selected={active}
              role="tab"
              className="flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5341CD]/40"
              style={{
                background: active ? "rgba(83,65,205,0.1)" : "transparent",
                color: active ? "#5341CD" : "rgb(var(--cn-muted))",
                fontWeight: active ? 600 : 500,
                letterSpacing: active ? "-0.01em" : "normal",
                transition:
                  "background 0.22s cubic-bezier(0.3,0,0.1,1), color 0.22s cubic-bezier(0.3,0,0.1,1), transform 0.15s cubic-bezier(0.3,0,0.1,1)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(0,0,0,0.04)";
                  el.style.color = "rgb(var(--cn-ink))";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "transparent";
                  el.style.color = "rgb(var(--cn-muted))";
                }
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Subtle divider */}
      <div className="mt-1 h-px bg-border/50" />
    </div>
  );
}
