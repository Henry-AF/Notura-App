"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalChatMessage {
  id: number;
  role: "user" | "ai";
  text: string;
  timestamp: string;
  isLoading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _msgId = 0;
function nextId(): number {
  return ++_msgId;
}

function formatTimestamp(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export interface MobileChatClientProps {
  id: string;
  meetingName: string;
}

export function MobileChatClient({ id, meetingName }: MobileChatClientProps) {
  const router = useRouter();

  // On desktop, redirect back to meeting detail
  useEffect(() => {
    if (window.innerWidth >= 768) {
      router.replace(`/dashboard/meetings/${id}`);
    }
  }, [id, router]);

  const [messages, setMessages] = useState<LocalChatMessage[]>(() => [
    {
      id: 0,
      role: "ai",
      text: "Olá! Posso responder perguntas sobre esta reunião. O que deseja saber?",
      timestamp: formatTimestamp(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Focus and scroll on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: LocalChatMessage = {
      id: nextId(),
      role: "user",
      text,
      timestamp: formatTimestamp(),
    };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const loadingId = nextId();
    setMessages((prev) => [
      ...prev,
      {
        id: loadingId,
        role: "ai",
        text: "",
        timestamp: formatTimestamp(),
        isLoading: true,
      },
    ]);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                text: `Com base na reunião "${meetingName}": em breve esta funcionalidade estará conectada à transcrição para responder com precisão.`,
                isLoading: false,
                timestamp: formatTimestamp(),
              }
            : m
        )
      );
    }, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight text-foreground">
              Chat com IA
            </p>
            <p className="text-[11px] leading-tight text-muted-foreground/60">
              Sobre esta reunião
            </p>
          </div>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div
        ref={bodyRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showTimestamp =
            !prevMsg ||
            prevMsg.role !== msg.role ||
            msg.timestamp !== prevMsg.timestamp;

          return (
            <React.Fragment key={msg.id}>
              {showTimestamp && index > 0 && (
                <div className="my-1 text-center text-[10px] text-muted-foreground/40">
                  {msg.timestamp}
                </div>
              )}
              <div
                className={cn(
                  "flex items-end gap-2",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* AI avatar */}
                {msg.role === "ai" && (
                  <div className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={cn(
                    "max-w-[78%] px-4 py-2.5 text-[14px] leading-relaxed",
                    msg.role === "user"
                      ? "rounded-[18px_18px_4px_18px] bg-primary text-primary-foreground"
                      : "rounded-[18px_18px_18px_4px] bg-muted/60 text-foreground"
                  )}
                >
                  {msg.isLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:160ms]" />
                      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:320ms]" />
                    </span>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div
        className="shrink-0 border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur-sm"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/30 px-4 py-2.5">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pergunte sobre esta reunião..."
            maxLength={3000}
            disabled={isTyping}
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            aria-label="Enviar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
          A IA pode cometer erros.
        </p>
      </div>
    </div>
  );
}
