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
        borderTop: "1px solid #2E2E2E",
        marginTop: 8,
      }}
    >
      <MapPin
        style={{ width: 14, height: 14, color: "#606060", flexShrink: 0 }}
      />
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          color: "#A0A0A0",
        }}
      >
        {location}
      </span>
    </div>
  );
}
