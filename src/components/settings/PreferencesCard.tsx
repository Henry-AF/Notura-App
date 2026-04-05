import React from "react";
import { SettingsToggle } from "./SettingsToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Preference {
  id: string;
  icon: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface PreferencesCardProps {
  preferences: Preference[];
  onToggle: (id: string, value: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PreferencesCard({ preferences, onToggle }: PreferencesCardProps) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: "#1C1C1C", borderColor: "#2E2E2E" }}
    >
      <h3 className="font-display text-[17px] font-bold text-white">
        Preferências
      </h3>

      <div className="mt-4 space-y-3">
        {preferences.map((pref) => (
          <div
            key={pref.id}
            className="flex items-center gap-3.5 rounded-[10px] p-[14px_16px]"
            style={{ background: "#242424" }}
          >
            {/* Icon */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
              style={{ background: "rgba(104,81,255,0.15)" }}
            >
              {pref.icon}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{pref.name}</p>
              <p className="text-[12px] text-[#A0A0A0]">{pref.description}</p>
            </div>

            {/* Toggle */}
            <SettingsToggle
              checked={pref.enabled}
              onChange={(val) => onToggle(pref.id, val)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
