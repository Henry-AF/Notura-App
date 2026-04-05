"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ─── Internal toast item ──────────────────────────────────────────────────────

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: "#4ECB71",
  error: "#FF6B6B",
  warning: "#FFA94D",
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 10);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 320);
    }, 3500);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 320);
  };

  return (
    <div
      style={{
        background: "#1E1E1E",
        borderTop: "1px solid #3A3A3A",
        borderRight: "1px solid #3A3A3A",
        borderBottom: "1px solid #3A3A3A",
        borderLeft: `3px solid ${BORDER_COLORS[toast.type]}`,
        borderRadius: "12px",
        padding: "14px 18px",
        minWidth: "280px",
        maxWidth: "360px",
        transform: visible ? "translateY(0)" : "translateY(80px)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s ease, opacity 0.3s ease",
      }}
      className="flex items-start gap-3 shadow-lg"
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: BORDER_COLORS[toast.type] }}
      />
      <p className="flex-1 text-sm text-white">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-[#606060] transition-colors hover:text-[#A0A0A0]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const show = useCallback((message: string, type: ToastType = "error") => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
