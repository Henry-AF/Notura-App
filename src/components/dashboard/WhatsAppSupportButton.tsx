"use client";

import React, { useEffect, useRef, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";

const STORAGE_KEY = "notura:support-btn-pos";
const BTN_SIZE = 52;
const EDGE_GAP = 16;
const DESKTOP_BOTTOM_GAP = 24;
const MOBILE_BOTTOM_GAP = 96;
const DRAG_THRESHOLD_PX = 6;
const SUPPORT_PHONE = "5513996495858";
const SUPPORT_MESSAGE = encodeURIComponent("Olá, preciso de ajuda com o Notura.");

function loadSavedPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // ignore
  }
  return null;
}

function savePosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function getBottomGap(): number {
  if (typeof window === "undefined") return DESKTOP_BOTTOM_GAP;
  return window.innerWidth < 768 ? MOBILE_BOTTOM_GAP : DESKTOP_BOTTOM_GAP;
}

function clamp(x: number, y: number): { x: number; y: number } {
  const bottomGap = getBottomGap();
  return {
    x: Math.max(EDGE_GAP, Math.min(window.innerWidth - BTN_SIZE - EDGE_GAP, x)),
    y: Math.max(
      EDGE_GAP,
      Math.min(window.innerHeight - BTN_SIZE - bottomGap, y)
    ),
  };
}

export function WhatsAppSupportButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startBtnX: number;
    startBtnY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const saved = loadSavedPosition();
    if (saved) {
      setPos(clamp(saved.x, saved.y));
      return;
    }
    const bottomGap = getBottomGap();
    setPos({
      x: window.innerWidth - BTN_SIZE - DESKTOP_BOTTOM_GAP,
      y: window.innerHeight - BTN_SIZE - bottomGap,
    });
  }, []);

  useEffect(() => {
    function handleResize() {
      setPos((current) => (current ? clamp(current.x, current.y) : current));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function openSupportChat() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://wa.me/${SUPPORT_PHONE}?text=${SUPPORT_MESSAGE}`
      : `https://web.whatsapp.com/send?phone=${SUPPORT_PHONE}&text=${SUPPORT_MESSAGE}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!pos) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    suppressClick.current = false;
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startBtnX: pos.x,
      startBtnY: pos.y,
      moved: false,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    setPos(clamp(d.startBtnX + dx, d.startBtnY + dy));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.moved) {
      suppressClick.current = true;
      setPos((current) => {
        if (current) savePosition(current);
        return current;
      });
    }
    drag.current = null;
  }

  if (!pos) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <button
        type="button"
        aria-label="Abrir suporte no WhatsApp"
        title="Fale conosco no WhatsApp"
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          openSupportChat();
        }}
        style={{
          width: BTN_SIZE,
          height: BTN_SIZE,
          borderRadius: "50%",
          background: "#6851FF",
          color: "#fff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(104,81,255,0.45)",
          transition: "background 0.15s, transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "#5740EE";
          el.style.transform = "scale(1.08)";
          el.style.boxShadow = "0 6px 28px rgba(104,81,255,0.6)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "#6851FF";
          el.style.transform = "scale(1)";
          el.style.boxShadow = "0 4px 20px rgba(104,81,255,0.45)";
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
        }}
      >
        <MessageCircleQuestion style={{ width: 24, height: 24 }} />
      </button>
    </div>
  );
}
