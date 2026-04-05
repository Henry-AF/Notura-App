"use client";

import React, { useMemo } from "react";
import { Plus } from "lucide-react";

export interface DashboardHeaderProps {
  userName: string;
  meetingsProcessedToday: number;
  onNewMeeting: () => void;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Bom dia", emoji: "👋" };
  if (hour >= 12 && hour < 18) return { text: "Boa tarde", emoji: "☀️" };
  return { text: "Boa noite", emoji: "🌙" };
}

export function DashboardHeader({
  userName,
  meetingsProcessedToday,
  onNewMeeting,
}: DashboardHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      {/* Left: greeting */}
      <div>
        <h1
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: "36px",
            lineHeight: 1.1,
            color: "#FFFFFF",
            margin: 0,
          }}
        >
          {greeting.text}, {userName} {greeting.emoji}
        </h1>
        <p
          className="mt-1.5"
          style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#A0A0A0" }}
        >
          Sua inteligência fluida processou{" "}
          <span style={{ color: "#FFFFFF", fontWeight: 700 }}>
            {meetingsProcessedToday} reuniões
          </span>{" "}
          hoje.
        </p>
      </div>

      {/* Right: CTA button */}
      <button
        type="button"
        onClick={onNewMeeting}
        className="flex shrink-0 items-center gap-2"
        style={{
          background: "#6C5CE7",
          color: "#FFFFFF",
          borderRadius: "999px",
          padding: "12px 24px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: "14px",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s, transform 0.1s",
          marginTop: "4px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#5A4BD1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#6C5CE7";
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        <Plus style={{ width: 18, height: 18 }} />
        Nova reunião
      </button>
    </div>
  );
}
