"use client";

import React from "react";
import { MapPin } from "lucide-react";

export interface MeetingLocationCardProps {
  location: string;
}

export function MeetingLocationCard({ location }: MeetingLocationCardProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "14px 0",
        borderTop: "1px solid rgb(var(--cn-border))",
        marginTop: 8,
      }}
    >
      <MapPin
        style={{ width: 14, height: 14, color: "rgb(var(--cn-muted))", flexShrink: 0 }}
      />
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          color: "rgb(var(--cn-ink2))",
        }}
      >
        {location}
      </span>
    </div>
  );
}
