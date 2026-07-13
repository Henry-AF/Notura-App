"use client";

import React, { useState } from "react";
import type { TaskLabel } from "./TaskCard";

const PRESET_COLORS = [
  "#6C5CE7", "#00CEC9", "#E91E8C", "#FFA94D",
  "#FF6B6B", "#4ECB71", "#74C0FC", "#A29BFE",
];

export interface LabelPickerProps {
  availableLabels: TaskLabel[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreateLabel?: (name: string, color: string) => Promise<void>;
}

export function LabelPicker({ availableLabels, selectedIds, onToggle, onCreateLabel }: LabelPickerProps) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !onCreateLabel) return;
    setCreating(true);
    try {
      await onCreateLabel(name, newColor);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
    } finally {
      setCreating(false);
    }
  }

  const LABEL_STYLE: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 600,
    color: "rgb(var(--cn-muted))",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 6,
  };

  return (
    <div>
      <p style={LABEL_STYLE}>Labels</p>

      {availableLabels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {availableLabels.map((label) => {
            const isSelected = selectedIds.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => onToggle(label.id)}
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: label.color,
                  background: isSelected ? `${label.color}2A` : `${label.color}10`,
                  border: `1.5px solid ${isSelected ? label.color : "transparent"}`,
                  padding: "3px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.12s",
                }}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      )}

      {onCreateLabel && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Novo label..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            style={{
              flex: 1,
              background: "rgb(var(--cn-input-bg))",
              border: "1px solid rgb(var(--cn-input-border))",
              borderRadius: 6,
              padding: "6px 10px",
              color: "rgb(var(--cn-ink))",
              fontSize: 12,
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 3 }}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                aria-label={`Cor ${c}`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: c,
                  border: newColor === c ? "2px solid rgb(var(--cn-ink))" : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || creating}
            style={{
              background: "#6C5CE7",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              cursor: newName.trim() && !creating ? "pointer" : "not-allowed",
              opacity: newName.trim() && !creating ? 1 : 0.4,
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
