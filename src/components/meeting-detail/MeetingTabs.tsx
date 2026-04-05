"use client";

import React from "react";

export type MeetingTab = "summary" | "transcript" | "tasks" | "decisions" | "pending";

export interface MeetingTabsProps {
  activeTab: MeetingTab;
  onChange: (tab: MeetingTab) => void;
}

const TABS: Array<{ key: MeetingTab; label: string }> = [
  { key: "summary", label: "Resumo" },
  { key: "transcript", label: "Transcrição" },
  { key: "tasks", label: "Tarefas" },
  { key: "decisions", label: "Decisões" },
  { key: "pending", label: "Pendências" },
];

export function MeetingTabs({ activeTab, onChange }: MeetingTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid #2E2E2E",
        marginBottom: 24,
        overflowX: "auto",
      }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: "12px 0",
              marginRight: 32,
              cursor: "pointer",
              position: "relative",
              background: "none",
              border: "none",
              fontFamily: "Inter, sans-serif",
              fontWeight: active ? 600 : 500,
              fontSize: 14,
              color: active ? "rgb(var(--cn-ink))" : "rgb(var(--cn-muted))",
              transition: "color 0.15s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!active)
                (e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-ink2))";
            }}
            onMouseLeave={(e) => {
              if (!active)
                (e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-muted))";
            }}
          >
            {tab.label}
            {active && (
              <span
                style={{
                  position: "absolute",
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "#6C5CE7",
                  borderRadius: "2px 2px 0 0",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
