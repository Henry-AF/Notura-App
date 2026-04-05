"use client";

import React from "react";

export interface SettingsToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggle({ checked, onChange, disabled }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative shrink-0 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6851FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1C1C] disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        width: "44px",
        height: "24px",
        background: checked ? "#6851FF" : "#3A3A3A",
        border: "none",
        transition: "background 0.2s ease",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "23px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#FFFFFF",
          transition: "left 0.2s ease",
          display: "block",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}
