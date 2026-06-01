"use client";

import React from "react";

export interface SettingsToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function SettingsToggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled ? true : undefined}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative shrink-0 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6851FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1C1C] disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        width: "44px",
        height: "24px",
        background: checked ? "#6851FF" : "rgb(var(--cn-input-border))",
        border: "none",
        transition: "background 0.2s ease",
        padding: 0,
      }}
    >
      <span
        className={`absolute left-[3px] top-[3px] block size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 ease ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
