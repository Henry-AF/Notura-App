"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Send, Sparkles, X } from "lucide-react";
import { AppSideSheet } from "@/components/ui/app";
import { cn } from "@/lib/utils";
import {
  createMeetingChat,
  waitForMeetingChat,
  type MeetingChatResponse,
  type MeetingChatSource,
} from "@/app/dashboard/meetings/[id]/meeting-client-api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _nextEntryId = 0;

function nextEntryId() {
  return ++_nextEntryId;
}

function formatMeetingChatFallback(reason: string | null): string {
  if (reason === "low_similarity")
    return "Não encontrei essa informação na transcrição desta reunião.";
  if (reason === "not_confirmed_by_model")
    return "Encontrei trechos relacionados, mas eles não confirmam a resposta com segurança.";
  if (reason === "meeting_not_ready")
    return "A reunião ainda está sendo processada. Tente novamente em instantes.";
  if (reason === "no_transcript")
    return "Esta reunião não possui transcrição disponível para consulta.";
  return "Não foi possível responder esta pergunta agora.";
}

function formatMs(ms: number | null): string {
  if (ms === null) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatEntry {
  id: number;
  question: string;
  response: MeetingChatResponse | null;
  error: string | null;
}

// ─── Source accordion ─────────────────────────────────────────────────────────

function SourceAccordion({ sources }: { sources: MeetingChatSource[] }) {
  const [open, setOpen] = useState(false);

  if (!sources.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary/70 transition-colors hover:text-primary"
      >
        <ChevronRight
          className="h-3 w-3 transition-transform duration-150"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        />
        Fontes ({sources.length})
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {sources.map((s) => (
            <div
              key={s.chunkId}
              className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs"
            >
              <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {s.speaker && <span>Falante {s.speaker}</span>}
                {(s.startMs !== null || s.endMs !== null) && (
                  <span>
                    {formatMs(s.startMs)} – {formatMs(s.endMs)}
                  </span>
                )}
                <span className="ml-auto tabular-nums">
                  {Math.round(s.similarity * 100)}% sim.
                </span>
              </div>
              <p className="m-0 leading-relaxed text-foreground/80">{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatEntryItem({ entry }: { entry: ChatEntry }) {
  const { question, response, error } = entry;
  const isProcessing = response === null && error === null;

  return (
    <div className="flex flex-col gap-2">
      {/* User question */}
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {question}
      </div>

      {/* AI answer */}
      <div className="self-start max-w-[85%]">
        {isProcessing && (
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
            <span className="text-xs text-muted-foreground">Analisando</span>
            <div className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl rounded-bl-sm bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {response?.status === "failed" && (
          <div className="rounded-2xl rounded-bl-sm bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Erro técnico ao processar esta pergunta.
          </div>
        )}

        {response?.status === "completed" && (
          <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
            <p className="m-0 text-sm leading-relaxed text-foreground">
              {response.modelConfirmed
                ? response.answer
                : formatMeetingChatFallback(response.fallbackReason)}
            </p>

            {response.modelConfirmed && response.sources.length > 0 && (
              <div className="mt-3 border-t border-border/40 pt-3">
                <SourceAccordion sources={response.sources} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary/70" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Analise esta reunião</p>
        <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
          Faça uma pergunta sobre o que foi discutido, decidido ou combinado.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const MAX_CHARS = 500;
const MAX_SENTENCES = 3;

export interface MeetingChatSheetProps {
  meetingId: string;
}

export function MeetingChatSheet({ meetingId }: MeetingChatSheetProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOverLimit =
    question.length > MAX_CHARS || countSentences(question) > MAX_SENTENCES;

  // Scroll to bottom when new entry is added or updated
  useEffect(() => {
    if (entries.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries]);

  // Focus textarea when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || processing || isOverLimit) return;

    const id = nextEntryId();
    setEntries((prev) => [...prev, { id, question: trimmed, response: null, error: null }]);
    setQuestion("");
    setProcessing(true);

    try {
      const { chatId } = await createMeetingChat(meetingId, trimmed);
      const result = await waitForMeetingChat(meetingId, chatId);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, response: result } : e))
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao processar pergunta.";
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, error: message } : e))
      );
    } finally {
      setProcessing(false);
    }
  }, [isOverLimit, meetingId, processing, question]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        aria-label="Abrir análise com IA"
        onClick={() => setOpen(true)}
        className="fixed bottom-7 right-7 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#5341CD] text-white shadow-[0_4px_20px_rgba(83,65,205,0.45)] transition-all duration-200 hover:bg-[#4433BB] hover:shadow-[0_6px_28px_rgba(83,65,205,0.6)] active:scale-95"
      >
        <Sparkles style={{ width: 22, height: 22 }} />
      </button>

      <AppSideSheet
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Chat de análise com IA"
        header={
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Notura AI</p>
                <p className="text-[11px] text-muted-foreground">
                  Pergunte sobre esta reunião
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        }
        footer={
          <div className="border-t border-border px-4 py-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={processing}
                placeholder="Quais prazos foram combinados?"
                rows={3}
                className={cn(
                  "w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  isOverLimit ? "border-destructive" : "border-input"
                )}
              />
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!question.trim() || processing || isOverLimit}
                aria-label="Enviar pergunta"
                className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-1.5 flex items-center justify-between px-1">
              <p
                className={cn(
                  "text-[10px]",
                  isOverLimit ? "text-destructive" : "text-muted-foreground"
                )}
              >
                Máx. 3 frases · {question.length}/{MAX_CHARS} chars
              </p>
              <p className="text-[10px] text-muted-foreground">Enter para enviar</p>
            </div>
          </div>
        }
      >
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {entries.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-5">
              {entries.map((entry) => (
                <ChatEntryItem key={entry.id} entry={entry} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </AppSideSheet>
    </>
  );
}
