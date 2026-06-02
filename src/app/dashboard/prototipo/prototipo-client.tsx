"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  Monitor,
  Upload,
  ArrowUp,
  Sparkles,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import GradientText from "@/components/ui/gradient-text";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/components/dashboard";

// ─── Static data ──────────────────────────────────────────────────────────────

const AI_PROMPTS = [
  "Pautas da última reunião com o cliente…",
  "Quais leis foram citadas na reunião de alinhamento de sexta?",
  "Quem ficou responsável pelas ações de onboarding?",
  "Resumo das decisões do kickoff de maio",
  "Próximos passos definidos com a equipe de produto",
  "Tarefas pendentes atribuídas à equipe jurídica",
];

const SUGGESTION_CHIPS = [
  "Última reunião",
  "Tarefas pendentes",
  "Decisões recentes",
  "Reuniões desta semana",
  "Quem falou mais nas reuniões?",
];

const RECORDING_MODES = [
  {
    key: "presencial",
    icon: Mic,
    label: "Gravação Presencial",
    description: "Capture pelo microfone do dispositivo",
    from: "#6851FF",
    to: "#9B87FF",
    glow: "rgba(104,81,255,0.20)",
  },
  {
    key: "remota",
    icon: Monitor,
    label: "Gravação Remota",
    description: "Capture áudio de reunião online",
    from: "#059669",
    to: "#34D399",
    glow: "rgba(5,150,105,0.20)",
  },
  {
    key: "upload",
    icon: Upload,
    label: "Enviar Gravação",
    description: "Processe um arquivo de áudio existente",
    from: "#D97706",
    to: "#FCD34D",
    glow: "rgba(217,119,6,0.20)",
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: "Bom dia", emoji: "👋" };
  if (h >= 12 && h < 18) return { text: "Boa tarde", emoji: "☀️" };
  return { text: "Boa noite", emoji: "🌙" };
}

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { bg: `hsla(${hue},60%,55%,0.15)`, color: `hsl(${hue},55%,42%)` };
}

const STATUS_MAP = {
  completed: { label: "Concluído", color: "#4ECB71", bg: "rgba(78,203,113,0.10)" },
  processing: { label: "Processando", color: "#74C0FC", bg: "rgba(116,192,252,0.10)" },
  failed: { label: "Falhou", color: "#FF6B6B", bg: "rgba(255,107,107,0.10)" },
} as const;

// ─── AnimatedPlaceholder ──────────────────────────────────────────────────────

function AnimatedPlaceholder({ prompts }: { prompts: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % prompts.length);
    }, 3600);
    return () => clearInterval(id);
  }, [prompts.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.38, ease: "easeInOut" }}
        className="pointer-events-none select-none"
      >
        {prompts[index]}
      </motion.span>
    </AnimatePresence>
  );
}

// ─── RecordingCard ────────────────────────────────────────────────────────────

interface RecordingCardProps {
  icon: React.ElementType;
  label: string;
  description: string;
  from: string;
  to: string;
  glow: string;
}

function RecordingCard({ icon: Icon, label, description, from, to, glow }: RecordingCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col items-start overflow-hidden rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{
        boxShadow: hovered
          ? `0 8px 32px ${glow}, 0 2px 8px rgba(0,0,0,0.06)`
          : undefined,
        borderColor: hovered ? `${from}55` : undefined,
      }}
    >
      {/* Hover gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-300"
        style={{
          background: `linear-gradient(145deg, ${from}10, ${to}06)`,
          opacity: hovered ? 1 : 0,
        }}
      />

      {/* Icon */}
      <div
        className="relative mb-3 flex size-10 items-center justify-center rounded-lg transition-all duration-200"
        style={{
          background: `linear-gradient(135deg, ${from}22, ${to}14)`,
          color: from,
          boxShadow: hovered ? `0 0 16px ${from}30` : undefined,
        }}
      >
        <Icon size={18} />
      </div>

      {/* Text */}
      <p className="relative text-[13px] font-semibold leading-snug text-foreground">
        {label}
      </p>
      <p className="relative mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </p>

      {/* Bottom arrow */}
      <div className="relative mt-3 flex items-center gap-1 text-[11px] font-semibold transition-colors duration-150" style={{ color: from }}>
        Iniciar
        <ArrowUp size={11} className="rotate-45 transition-transform duration-200 group-hover:rotate-45 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </button>
  );
}

// ─── MeetingRow ───────────────────────────────────────────────────────────────

function MeetingRow({ meeting, last }: { meeting: Meeting; last: boolean }) {
  const s = STATUS_MAP[meeting.status];
  const av = getAvatarStyle(meeting.title);
  const initial = meeting.title.trim()[0]?.toUpperCase() ?? "?";

  return (
    <>
      <div className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
        {/* Avatar */}
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
          style={{ background: av.bg, color: av.color }}
        >
          {initial}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-foreground">
            {meeting.title}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {meeting.date}
            </span>
            {meeting.groupName && (
              <>
                <span className="text-border">·</span>
                <span className="opacity-70">{meeting.groupName}</span>
              </>
            )}
          </div>
        </div>

        {/* Status + action */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex"
            style={{ background: s.bg, color: s.color }}
          >
            {s.label}
          </span>
          {meeting.status === "processing" ? (
            <Loader2 size={14} className="animate-spin text-[#74C0FC]" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground/40" />
          )}
        </div>
      </div>
      {!last && <div className="mx-4 h-px bg-border/50" />}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PrototipoClientProps {
  userName: string;
  meetings: Meeting[];
}

export function PrototipoClient({ userName, meetings }: PrototipoClientProps) {
  const greeting = useMemo(getGreeting, []);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* ── Ambient radial glow ─────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 45% at 50% 20%, rgba(104,81,255,0.07) 0%, transparent 72%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">

        {/* ── Greeting ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="mb-10"
        >
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Dashboard · IA
          </p>
          <h1 className="text-[28px] font-bold leading-tight text-foreground sm:text-3xl">
            {greeting.text},{" "}
            <GradientText
              colors={["#7C3AED", "#A855F7", "#C084FC", "#A855F7", "#7C3AED"]}
              animationSpeed={4}
              showBorder={false}
            >
              {userName}
            </GradientText>{" "}
            {greeting.emoji}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Pergunte qualquer coisa sobre suas reuniões ou inicie uma nova gravação.
          </p>
        </motion.div>

        {/* ── AI chat input ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
          className="mb-3"
        >
          <div
            className={cn(
              "group relative rounded-2xl border bg-card shadow-sm transition-all duration-300",
              focused
                ? "border-primary/50 shadow-[0_0_0_3px_rgba(104,81,255,0.10),0_4px_28px_rgba(104,81,255,0.09)]"
                : "border-border hover:border-border/70 hover:shadow-md"
            )}
          >
            {/* Sparkle */}
            <div
              className={cn(
                "pointer-events-none absolute left-4 top-[18px] transition-colors duration-200",
                focused ? "text-primary" : "text-muted-foreground/50"
              )}
            >
              <Sparkles size={18} />
            </div>

            {/* Animated placeholder layer (only when empty) */}
            {query === "" && (
              <div className="pointer-events-none absolute left-12 top-[18px] text-[15px] text-muted-foreground/50">
                <AnimatedPlaceholder prompts={AI_PROMPTS} />
              </div>
            )}

            {/* Textarea */}
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={3}
              className="w-full resize-none rounded-2xl bg-transparent pl-12 pr-4 pt-[18px] pb-14 text-[15px] text-foreground outline-none"
              placeholder=""
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
              }}
            />

            {/* Bottom bar */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2.5">
              <span className="hidden text-[11px] text-muted-foreground/40 sm:block">
                Shift+Enter para nova linha
              </span>
              <button
                type="button"
                disabled={query.trim().length === 0}
                className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 disabled:opacity-30 active:scale-95"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Suggestion chips ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mb-10 flex flex-wrap gap-2"
        >
          {SUGGESTION_CHIPS.map((chip, i) => (
            <motion.button
              key={chip}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: 0.18 + i * 0.05 }}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground shadow-sm transition-all duration-150 hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
            >
              {chip}
            </motion.button>
          ))}
        </motion.div>

        {/* ── Recording section ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.22, ease: "easeOut" }}
          className="mb-10"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Iniciar gravação
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {RECORDING_MODES.map(({ key: modeKey, ...rest }) => (
              <RecordingCard key={modeKey} {...rest} />
            ))}
          </div>
        </motion.div>

        {/* ── Recent meetings ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.32, ease: "easeOut" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Reuniões recentes
            </p>
            <button
              type="button"
              className="flex items-center gap-1 text-[12px] font-medium text-primary/70 transition-colors hover:text-primary"
            >
              Ver todas <ChevronRight size={12} />
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {meetings.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Nenhuma reunião encontrada.
              </div>
            ) : (
              meetings.slice(0, 5).map((m, i) => (
                <MeetingRow key={m.id} meeting={m} last={i === Math.min(meetings.length, 5) - 1} />
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
