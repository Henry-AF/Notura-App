"use client";

import React from "react";
import { motion } from "motion/react";

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
  const [hoveredTab, setHoveredTab] = React.useState<MeetingTab | null>(null);

  return (
    <div className="mb-6">
      <div
        className="overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          background: "rgb(var(--secondary) / 0.55)",
          border: "1px solid rgb(var(--border) / 0.55)",
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.18)",
        }}
        onMouseLeave={() => setHoveredTab(null)}
      >
        <div className="flex min-w-max items-center gap-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const highlighted = (hoveredTab ?? activeTab) === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              onMouseEnter={() => setHoveredTab(tab.key)}
              onFocus={() => setHoveredTab(tab.key)}
              onBlur={() => setHoveredTab(null)}
              aria-selected={active}
              role="tab"
              className="relative flex-shrink-0 whitespace-nowrap rounded-full px-5 py-2.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5341CD]/40"
              style={{
                color: active ? "rgb(var(--foreground))" : "rgb(var(--muted-foreground))",
                fontWeight: active ? 600 : 500,
                letterSpacing: active ? "-0.01em" : "normal",
                transition:
                  "color 0.2s ease, transform 0.15s cubic-bezier(0.3,0,0.1,1)",
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              {highlighted ? (
                <motion.span
                  layoutId="meeting-tabs-pill"
                  className="pointer-events-none absolute inset-0 rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.85 }}
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgb(var(--primary) / 0.22), rgb(var(--primary) / 0.12))"
                      : "rgb(var(--card) / 0.92)",
                    border: active
                      ? "1px solid rgb(var(--primary) / 0.22)"
                      : "1px solid rgb(var(--border) / 0.6)",
                    boxShadow: active
                      ? "0 8px 20px rgba(104,81,255,0.16)"
                      : "0 1px 2px rgba(15,23,42,0.08)",
                  }}
                />
              ) : null}

              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}
