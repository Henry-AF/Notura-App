"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, onClose]);
}

const STORAGE_KEY = "notura:support-btn-pos";
const BTN_SIZE = 52;
const EDGE_GAP = 16;
const DESKTOP_BOTTOM_GAP = 24;
const MOBILE_BOTTOM_GAP = 96;
const DRAG_THRESHOLD_PX = 6;

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
  const [open, setOpen] = useState(false);
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

  const handleClose = useCallback(() => setOpen(false), []);
  useClickOutside(containerRef, handleClose);

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

  const popupAbove = pos ? pos.y > window.innerHeight / 2 : true;
  const popupLeft = pos ? pos.x > 150 : false;

  const popupStyle: React.CSSProperties = {
    position: "absolute",
    width: 280,
    borderRadius: 16,
    background: "rgb(var(--cn-bg2))",
    border: "1px solid rgba(var(--cn-surface2), 0.6)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    padding: "20px",
    ...(popupAbove ? { bottom: BTN_SIZE + 12 } : { top: BTN_SIZE + 12 }),
    ...(popupLeft ? { right: 0 } : { left: 0 }),
  };

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
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Contato via WhatsApp"
          style={popupStyle}
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgb(var(--cn-ink))",
              opacity: 0.5,
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.5";
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(37,211,102,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
                  fill="#25D166"
                />
                <path
                  d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.41A9.962 9.962 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.296-1.254l-.308-.183-3.188.903.86-3.097-.2-.317A7.969 7.969 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"
                  fill="#25D166"
                />
              </svg>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "rgb(var(--cn-ink))",
              }}
            >
              Suporte Notura
            </p>
          </div>

          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgb(var(--cn-ink))",
              opacity: 0.75,
            }}
          >
            Precisa de ajuda? Fale conosco pelo WhatsApp!
          </p>

          <a
            href="https://wa.me/5513996495858"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "10px 0",
              borderRadius: 10,
              background: "#25D166",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              transition: "background 0.15s",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#1db954";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "#25D166";
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
                fill="white"
              />
              <path
                d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.41A9.962 9.962 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.296-1.254l-.308-.183-3.188.903.86-3.097-.2-.317A7.969 7.969 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"
                fill="white"
              />
            </svg>
            Abrir WhatsApp
          </a>
        </div>
      )}

      <button
        type="button"
        aria-label="Entrar em contato"
        title="Fale conosco"
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setOpen((v) => !v);
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
