"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send } from "lucide-react";
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

let _localMsgId = 0;
function nextLocalMsgId(): number {
  return ++_localMsgId;
}

function formatTimestamp(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface MeetingInlineChatPanelProps {
  meetingName: string;
  onClose: () => void;
}

export function MeetingInlineChatPanel({
  meetingName,
  onClose,
}: MeetingInlineChatPanelProps) {
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: LocalChatMessage = {
      id: nextLocalMsgId(),
      role: "user",
      text,
      timestamp: formatTimestamp(),
    };

    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Loading bubble
    const loadingId = nextLocalMsgId();
    setMessages((prev) => [
      ...prev,
      {
        id: loadingId,
        role: "ai",
        text: "Analisando a reunião...",
        timestamp: formatTimestamp(),
        isLoading: true,
      },
    ]);

    // Simulate AI response after 1.2s
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
    }, 1200);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      role="complementary"
      aria-label="Chat com IA"
      className="flex h-full w-full flex-col border-l border-border/50 bg-card/98 backdrop-blur-sm"
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">Chat com IA</p>
            <p className="text-[11px] text-muted-foreground/60">Sobre esta reunião</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar chat"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div
        ref={bodyRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2.5",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {msg.role === "user" ? "EU" : <Sparkles className="h-3 w-3" />}
            </div>

            {/* Bubble + timestamp */}
            <div
              className={cn(
                "flex max-w-[220px] flex-col gap-1",
                msg.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  msg.role === "user"
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm bg-muted/70 text-foreground",
                  msg.isLoading && "animate-pulse opacity-60"
                )}
              >
                {msg.text}
              </div>
              <span className="px-1 text-[10px] text-muted-foreground/50">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border/40 px-3 pb-4 pt-3">
        <div className="flex items-end gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre essa reunião..."
            maxLength={3000}
            disabled={isTyping}
            className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
            style={{ lineHeight: "1.5", maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="text-[10px] text-muted-foreground/50">A IA pode cometer erros.</span>
          <span className="text-[10px] text-muted-foreground/40">{input.length}/3000</span>
        </div>
      </div>
    </div>
  );
}
