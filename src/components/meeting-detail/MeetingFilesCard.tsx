"use client";

import React from "react";
import { FileText, Image as ImageIcon } from "lucide-react";

export interface MeetingFile {
  id: string;
  name: string;
  size: string;
  type: "pdf" | "image" | "doc" | "other";
  url: string;
}

export interface MeetingFilesCardProps {
  files: MeetingFile[];
  onViewAll: () => void;
  onOpenFile: (file: MeetingFile) => void;
}

function FileIcon({ type }: { type: MeetingFile["type"] }) {
  if (type === "pdf") {
    return (
      <div
        style={{
          width: 28,
          height: 34,
          background: "rgba(255,107,107,0.15)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FileText style={{ width: 14, height: 14, color: "#FF8A8A" }} />
      </div>
    );
  }
  if (type === "image") {
    return (
      <div
        style={{
          width: 28,
          height: 34,
          background: "rgba(116,192,252,0.15)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ImageIcon style={{ width: 14, height: 14, color: "#74C0FC" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: 28,
        height: 34,
        background: "rgba(160,160,160,0.15)",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <FileText style={{ width: 14, height: 14, color: "#A0A0A0" }} />
    </div>
  );
}

export function MeetingFilesCard({
  files,
  onViewAll,
  onOpenFile,
}: MeetingFilesCardProps) {
  return (
    <div
      style={{
        borderTop: "1px solid rgb(var(--cn-border))",
        paddingTop: 16,
        marginTop: 8,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            color: "rgb(var(--cn-muted))",
            letterSpacing: "0.1em",
          }}
        >
          Arquivos
        </span>
        <button
          type="button"
          onClick={onViewAll}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            fontSize: 12,
            color: "#6C5CE7",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "#A29BFE")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "#6C5CE7")
          }
        >
          Ver todos
        </button>
      </div>

      {/* File list */}
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => onOpenFile(file)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: "rgb(var(--cn-bg))",
            borderRadius: 8,
            marginBottom: 6,
            cursor: "pointer",
            transition: "background 0.15s",
            width: "100%",
            border: "none",
            textAlign: "left",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--cn-card2))")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--cn-bg))")
          }
        >
          <FileIcon type={file.type} />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: 12,
              color: "rgb(var(--cn-ink))",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 160,
              flex: 1,
            }}
          >
            {file.name}
          </span>
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: 11,
              color: "rgb(var(--cn-muted))",
              marginLeft: "auto",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {file.size}
          </span>
        </button>
      ))}
    </div>
  );
}
