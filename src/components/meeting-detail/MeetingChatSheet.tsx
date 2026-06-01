"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { AppSideSheet } from "@/components/ui/app";
import { cn } from "@/lib/utils";
import {
  createMeetingChat,
  fetchMeetingArchivedChats,
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

function formatResponseTime(createdAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const created = new Date(createdAt).getTime();
  const completed = new Date(completedAt).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(completed) || completed <= created) return null;
  const seconds = (completed - created) / 1000;
  return `Respondeu em ${seconds.toFixed(1)}s`;
}

function getChatResponseText(chat: Pick<
  MeetingChatResponse,
  "status" | "errorMessage" | "modelConfirmed" | "answer" | "fallbackReason"
>): string {
  if (chat.status === "failed") {
    return chat.errorMessage ?? "Erro técnico ao processar esta pergunta.";
  }

  if (chat.modelConfirmed && chat.answer) return chat.answer;
  return formatMeetingChatFallback(chat.fallbackReason);
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
        className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-primary transition-colors hover:opacity-80"
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

function FeedbackButtons() {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  function handleFeedback(value: "up" | "down") {
    setFeedback((prev) => (prev === value ? null : value));
  }

  return (
    <div className="flex items-center justify-end gap-2" style={{ marginTop: 10 }}>
      <button
        type="button"
        aria-label="Resposta útil"
        onClick={() => handleFeedback("up")}
        style={{
          background: feedback === "up" ? "rgba(16,185,129,0.12)" : "transparent",
          border: "none",
          borderRadius: 6,
          padding: "4px 6px",
          cursor: "pointer",
          color: feedback === "up" ? "#10B981" : "#9CA3AF",
          transition: "color 0.15s, background 0.15s",
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => {
          if (feedback !== "up") (e.currentTarget as HTMLButtonElement).style.color = "#10B981";
        }}
        onMouseLeave={(e) => {
          if (feedback !== "up") (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF";
        }}
      >
        <ThumbsUp style={{ width: 16, height: 16 }} />
      </button>
      <button
        type="button"
        aria-label="Resposta não útil"
        onClick={() => handleFeedback("down")}
        style={{
          background: feedback === "down" ? "rgba(239,68,68,0.12)" : "transparent",
          border: "none",
          borderRadius: 6,
          padding: "4px 6px",
          cursor: "pointer",
          color: feedback === "down" ? "#EF4444" : "#9CA3AF",
          transition: "color 0.15s, background 0.15s",
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => {
          if (feedback !== "down") (e.currentTarget as HTMLButtonElement).style.color = "#EF4444";
        }}
        onMouseLeave={(e) => {
          if (feedback !== "down") (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF";
        }}
      >
        <ThumbsDown style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}

function ChatAnswerCard({
  response,
}: {
  response: Pick<
    MeetingChatResponse,
    | "status"
    | "answer"
    | "fallbackReason"
    | "modelConfirmed"
    | "sources"
    | "errorMessage"
    | "createdAt"
    | "completedAt"
  >;
}) {
  const responseText = getChatResponseText(response);
  const sources = Array.isArray(response.sources) ? response.sources : [];
  const responseTimeLabel =
    response.status === "completed"
      ? formatResponseTime(response.createdAt, response.completedAt)
      : null;
  const isFailed = response.status === "failed";

  return (
    <div>
      <div
        className={cn(
          "rounded-2xl rounded-bl-sm border px-4 py-3",
          isFailed
            ? "border-destructive/20 bg-destructive/10"
            : "border-border/60 bg-card text-card-foreground shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        )}
      >
        <p className={cn("m-0 text-sm leading-relaxed", isFailed && "text-destructive")}>
          {responseText}
        </p>

        {!isFailed && response.modelConfirmed && sources.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <SourceAccordion sources={sources} />
          </div>
        )}

        {!isFailed && <FeedbackButtons />}
      </div>
      {responseTimeLabel && (
        <p className="mt-1 pl-2 text-[11px] text-muted-foreground/80">{responseTimeLabel}</p>
      )}
    </div>
  );
}

function ArchivedChatsEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <MessageSquareText className="h-6 w-6 text-primary/70" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Nenhum chat arquivado</p>
        <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
          As perguntas concluídas desta reunião vão aparecer aqui para consulta.
        </p>
      </div>
    </div>
  );
}

function ArchivedChatListItem({
  chat,
  onOpen,
}: {
  chat: MeetingChatResponse;
  onOpen: (chat: MeetingChatResponse) => void;
}) {
  const responseTimeLabel =
    chat.status === "completed"
      ? formatResponseTime(chat.createdAt, chat.completedAt)
      : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(chat)}
      className="w-full rounded-[22px] border border-border/60 bg-card/90 p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)] hover:-translate-y-0.5 hover:bg-card hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-foreground">{chat.question}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(chat.createdAt))}</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/72">
        {getChatResponseText(chat)}
      </p>
      {responseTimeLabel && (
        <p className="mt-3 text-[11px] text-muted-foreground/80">{responseTimeLabel}</p>
      )}
    </button>
  );
}

function ArchivedChatDetail({ chat }: { chat: MeetingChatResponse }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {chat.question}
      </div>
      <div className="self-start max-w-[85%]">
        <ChatAnswerCard response={chat} />
      </div>
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

        {response?.status === "failed" && <ChatAnswerCard response={response} />}

        {response?.status === "completed" && <ChatAnswerCard response={response} />}
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
const TRANSITION_EASING = "cubic-bezier(0.3,0,0.1,1)";

type ChatSheetMode = "new" | "archived";
type ArchivedPane = "list" | "detail";

export interface MeetingChatSheetProps {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface MeetingArchivedChatsSheetProps {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingTitle: string;
  chats: MeetingChatResponse[];
  initialChatId?: string | null;
}

export function MeetingChatSheet({
  meetingId,
  open,
  onOpenChange,
}: MeetingChatSheetProps) {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<ChatSheetMode>("new");
  const [archivedPane, setArchivedPane] = useState<ArchivedPane>("list");
  const [archivedChats, setArchivedChats] = useState<MeetingChatResponse[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [selectedArchivedChatId, setSelectedArchivedChatId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOverLimit =
    question.length > MAX_CHARS || countSentences(question) > MAX_SENTENCES;
  const selectedArchivedChat = selectedArchivedChatId
    ? archivedChats.find((chat) => chat.id === selectedArchivedChatId) ?? null
    : null;
  const isArchivedDetailOpen =
    mode === "archived" && archivedPane === "detail" && selectedArchivedChat !== null;

  // Scroll to bottom when new entry is added or updated
  useEffect(() => {
    if (mode === "new" && entries.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, mode]);

  // Focus textarea when sheet opens
  useEffect(() => {
    if (open && mode === "new") {
      const focusTimer = setTimeout(() => textareaRef.current?.focus(), 200);
      return () => clearTimeout(focusTimer);
    }
  }, [mode, open]);

  useEffect(() => {
    if (!open) {
      setMode("new");
      setArchivedPane("list");
      setSelectedArchivedChatId(null);
      setArchivedError(null);
    }
  }, [open]);

  const loadArchivedChats = useCallback(async () => {
    setArchivedLoading(true);
    setArchivedError(null);

    try {
      const chats = await fetchMeetingArchivedChats(meetingId);
      setArchivedChats(chats);
      if (selectedArchivedChatId && !chats.some((chat) => chat.id === selectedArchivedChatId)) {
        setSelectedArchivedChatId(null);
        setArchivedPane("list");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar chats arquivados.";
      setArchivedError(message);
    } finally {
      setArchivedLoading(false);
    }
  }, [meetingId, selectedArchivedChatId]);

  useEffect(() => {
    if (open && mode === "archived") {
      void loadArchivedChats();
    }
  }, [loadArchivedChats, mode, open]);

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
      setArchivedChats((prev) => [result, ...prev.filter((chat) => chat.id !== result.id)]);
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

  const openArchivedList = useCallback(() => {
    setMode("archived");
    setArchivedPane("list");
    setSelectedArchivedChatId(null);
  }, []);

  const openArchivedChat = useCallback((chat: MeetingChatResponse) => {
    setMode("archived");
    setArchivedPane("detail");
    setSelectedArchivedChatId(chat.id);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  const header = (
      <div className="border-b border-border/60 bg-background/80 px-5 py-4 backdrop-blur-[14px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {isArchivedDetailOpen ? (
            <button
              type="button"
              aria-label="Voltar para lista de chats arquivados"
              onClick={() => {
                setArchivedPane("list");
                setSelectedArchivedChatId(null);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-foreground transition-all duration-200 hover:scale-[0.98] hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Notura AI</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {isArchivedDetailOpen
                ? "Chats arquivados desta reunião"
                : mode === "archived"
                  ? "Revise perguntas anteriores"
                  : "Pergunte sobre esta reunião"}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Fechar"
          onClick={() => onOpenChange(false)}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isArchivedDetailOpen && (
        <div className="mt-4 rounded-[18px] border border-border/50 bg-muted/80 p-1 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.05)] backdrop-blur-[10px]">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={cn(
                "rounded-[14px] px-3 py-2 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
                mode === "new"
                  ? "bg-card text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Nova pergunta
            </button>
            <button
              type="button"
              onClick={openArchivedList}
              className={cn(
                "rounded-[14px] px-3 py-2 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
                mode === "archived"
                  ? "bg-card text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Chats arquivados
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const footer =
    mode === "new" ? (
      <div className="border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur-[14px]">
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
              "w-full resize-none rounded-[18px] border border-border/50 bg-muted px-4 py-3 pr-12 text-sm text-foreground shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.05)] transition-all duration-200 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              isOverLimit && "ring-1 ring-destructive"
            )}
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!question.trim() || processing || isOverLimit}
            aria-label="Enviar pergunta"
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all duration-200 hover:scale-[0.98] hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
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
    ) : (
      null
    );

  return (
    <AppSideSheet
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Chat de análise com IA"
      header={header}
      footer={footer}
    >
      <div className="relative flex-1 overflow-hidden bg-background">
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto px-4 py-4 transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
            mode === "new"
              ? "translate-x-0 opacity-100"
              : "-translate-x-6 opacity-0 pointer-events-none"
          )}
          style={{ transitionTimingFunction: TRANSITION_EASING }}
        >
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

        <div
          className={cn(
            "absolute inset-0 overflow-y-auto px-4 py-4 transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
            mode === "archived" && archivedPane === "list"
              ? "translate-x-0 opacity-100"
              : mode === "archived"
                ? "-translate-x-6 opacity-0 pointer-events-none"
                : "translate-x-6 opacity-0 pointer-events-none"
          )}
          style={{ transitionTimingFunction: TRANSITION_EASING }}
        >
          {archivedLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-[22px] border border-border/60 bg-card/90 px-4 py-3 text-sm text-muted-foreground shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-[10px]">
                Carregando chats arquivados...
              </div>
            </div>
          ) : archivedError ? (
            <div className="rounded-[22px] bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {archivedError}
            </div>
          ) : archivedChats.length === 0 ? (
            <ArchivedChatsEmptyState />
          ) : (
            <div className="flex flex-col gap-3">
              {archivedChats.map((chat) => (
                <ArchivedChatListItem key={chat.id} chat={chat} onOpen={openArchivedChat} />
              ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            "absolute inset-0 overflow-y-auto px-4 py-4 transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
            isArchivedDetailOpen
              ? "translate-x-0 opacity-100"
              : "translate-x-6 opacity-0 pointer-events-none"
          )}
          style={{ transitionTimingFunction: TRANSITION_EASING }}
        >
          {selectedArchivedChat ? <ArchivedChatDetail chat={selectedArchivedChat} /> : null}
        </div>
      </div>
    </AppSideSheet>
  );
}

export function MeetingArchivedChatsSheet({
  meetingId,
  open,
  onOpenChange,
  meetingTitle,
  chats,
  initialChatId = null,
}: MeetingArchivedChatsSheetProps) {
  const [mode, setMode] = useState<ChatSheetMode>("archived");
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [createdChats, setCreatedChats] = useState<MeetingChatResponse[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId);
  const [archivedPane, setArchivedPane] = useState<ArchivedPane>(
    initialChatId ? "detail" : "list"
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visibleChats = useMemo(
    () => [
      ...createdChats,
      ...chats.filter((chat) => !createdChats.some((created) => created.id === chat.id)),
    ],
    [chats, createdChats]
  );
  const isOverLimit =
    question.length > MAX_CHARS || countSentences(question) > MAX_SENTENCES;

  useEffect(() => {
    if (!open) {
      setMode("archived");
      setQuestion("");
      setEntries([]);
      setProcessing(false);
      setArchivedPane(initialChatId ? "detail" : "list");
      setSelectedChatId(initialChatId);
      return;
    }

    setMode("archived");
    setArchivedPane(initialChatId ? "detail" : "list");
    setSelectedChatId(initialChatId);
  }, [initialChatId, open]);

  useEffect(() => {
    if (selectedChatId && !visibleChats.some((chat) => chat.id === selectedChatId)) {
      setSelectedChatId(null);
      setArchivedPane("list");
    }
  }, [selectedChatId, visibleChats]);

  useEffect(() => {
    if (mode === "new" && entries.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, mode]);

  useEffect(() => {
    if (open && mode === "new") {
      const focusTimer = setTimeout(() => textareaRef.current?.focus(), 200);
      return () => clearTimeout(focusTimer);
    }
  }, [mode, open]);

  const selectedChat = selectedChatId
    ? visibleChats.find((chat) => chat.id === selectedChatId) ?? null
    : null;
  const isDetailOpen = archivedPane === "detail" && selectedChat !== null;
  const isNewMode = mode === "new";

  const handleSubmit = useCallback(async () => {
    const trimmed = question.trim();
    if (!meetingId || !trimmed || processing || isOverLimit) return;

    const id = nextEntryId();
    setEntries((prev) => [...prev, { id, question: trimmed, response: null, error: null }]);
    setQuestion("");
    setProcessing(true);

    try {
      const { chatId } = await createMeetingChat(meetingId, trimmed);
      const result = await waitForMeetingChat(meetingId, chatId);
      setCreatedChats((prev) => [result, ...prev.filter((chat) => chat.id !== result.id)]);
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, response: result } : entry))
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao processar pergunta.";
      setEntries((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, error: message } : entry))
      );
    } finally {
      setProcessing(false);
    }
  }, [isOverLimit, meetingId, processing, question]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  function openArchivedList() {
    setMode("archived");
    setArchivedPane("list");
    setSelectedChatId(null);
  }

  return (
    <AppSideSheet
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Chats arquivados da reunião"
      header={
        <div className="border-b border-border/60 bg-background/80 px-5 py-4 backdrop-blur-[14px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {isDetailOpen ? (
                <button
                  type="button"
                  aria-label="Voltar para lista de chats arquivados"
                  onClick={() => {
                    setArchivedPane("list");
                    setSelectedChatId(null);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-foreground transition-all duration-200 hover:scale-[0.98] hover:bg-accent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Notura AI</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {isDetailOpen
                    ? meetingTitle
                    : isNewMode
                      ? "Pergunte sobre esta reunião"
                      : `${meetingTitle} · chats arquivados`}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Fechar"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isDetailOpen && (
            <div className="mt-4 rounded-[18px] border border-border/50 bg-muted/80 p-1 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.05)] backdrop-blur-[10px]">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={cn(
                    "rounded-[14px] px-3 py-2 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
                    mode === "new"
                      ? "bg-card text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Nova pergunta
                </button>
                <button
                  type="button"
                  onClick={openArchivedList}
                  className={cn(
                    "rounded-[14px] px-3 py-2 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
                    mode === "archived"
                      ? "bg-card text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Chats arquivados
                </button>
              </div>
            </div>
          )}
        </div>
      }
      footer={
        isNewMode ? (
          <div className="border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur-[14px]">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={processing}
                placeholder="Quais prazos foram combinados?"
                rows={3}
                className={cn(
                  "w-full resize-none rounded-[18px] border border-border/50 bg-muted px-4 py-3 pr-12 text-sm text-foreground shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.05)] transition-all duration-200 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  isOverLimit && "ring-1 ring-destructive"
                )}
              />
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!question.trim() || processing || isOverLimit}
                aria-label="Enviar pergunta"
                className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all duration-200 hover:scale-[0.98] hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
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
        ) : null
      }
    >
      <div className="relative flex-1 overflow-hidden bg-background">
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto px-4 py-4 transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
            isNewMode
              ? "translate-x-0 opacity-100"
              : "-translate-x-6 opacity-0 pointer-events-none"
          )}
          style={{ transitionTimingFunction: TRANSITION_EASING }}
        >
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

        <div
          className={cn(
            "absolute inset-0 overflow-y-auto px-4 py-4 transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
            mode === "archived" && archivedPane === "list"
              ? "translate-x-0 opacity-100"
              : mode === "archived"
                ? "-translate-x-6 opacity-0 pointer-events-none"
                : "translate-x-6 opacity-0 pointer-events-none"
          )}
          style={{ transitionTimingFunction: TRANSITION_EASING }}
        >
          {visibleChats.length === 0 ? (
            <ArchivedChatsEmptyState />
          ) : (
            <div className="flex flex-col gap-3">
              {visibleChats.map((chat) => (
                <ArchivedChatListItem
                  key={chat.id}
                  chat={chat}
                  onOpen={(item) => {
                    setMode("archived");
                    setSelectedChatId(item.id);
                    setArchivedPane("detail");
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            "absolute inset-0 overflow-y-auto px-4 py-4 transition-all duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
            isDetailOpen
              ? "translate-x-0 opacity-100"
              : "translate-x-6 opacity-0 pointer-events-none"
          )}
          style={{ transitionTimingFunction: TRANSITION_EASING }}
        >
          {selectedChat ? <ArchivedChatDetail chat={selectedChat} /> : null}
        </div>
      </div>
    </AppSideSheet>
  );
}
