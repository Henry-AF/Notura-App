"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Monitor, Upload, ArrowUp, Clock, ChevronRight } from "lucide-react";
import GradientText from "@/components/ui/gradient-text";
import type { Meeting } from "@/components/dashboard";

// ─── Data ─────────────────────────────────────────────────────────────────────

const AI_PROMPTS = [
  "Pautas da última reunião com o cliente…",
  "Quais leis foram citadas na reunião de sexta?",
  "Quem ficou responsável pelo onboarding?",
  "Decisões tomadas no kickoff de maio",
  "Próximos passos da equipe de produto",
  "Tarefas pendentes atribuídas à equipe jurídica",
];

const RECORDING_MODES = [
  {
    key: "presencial",
    icon: Mic,
    label: "Gravação Presencial",
    description: "Pelo microfone do dispositivo",
    color: "#6851FF",
  },
  {
    key: "remota",
    icon: Monitor,
    label: "Gravação Remota",
    description: "Capture áudio de reunião online",
    color: "#059669",
  },
  {
    key: "upload",
    icon: Upload,
    label: "Enviar Arquivo",
    description: "Processe uma gravação existente",
    color: "#D97706",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: "Bom dia", emoji: "👋" };
  if (h >= 12 && h < 18) return { text: "Boa tarde", emoji: "☀️" };
  return { text: "Boa noite", emoji: "🌙" };
}

// ─── AnimatedPlaceholder ──────────────────────────────────────────────────────

function AnimatedPlaceholder({ prompts }: { prompts: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % prompts.length),
      3600
    );
    return () => clearInterval(id);
  }, [prompts.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="pointer-events-none select-none"
      >
        {prompts[index]}
      </motion.span>
    </AnimatePresence>
  );
}

// ─── RecordingPill ────────────────────────────────────────────────────────────

interface RecordingPillProps {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
}

function RecordingPill({ icon: Icon, label, description, color }: RecordingPillProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-1 items-center gap-3.5 rounded-2xl border bg-card px-5 py-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98]"
      style={{
        borderColor: hovered ? `${color}60` : `${color}25`,
        backgroundColor: hovered ? `${color}08` : undefined,
        boxShadow: hovered ? `0 4px 20px ${color}18` : undefined,
      }}
    >
      {/* Icon bubble */}
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
        style={{
          background: `${color}15`,
          color,
          boxShadow: hovered ? `0 0 12px ${color}28` : undefined,
        }}
      >
        <Icon size={16} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{description}</p>
      </div>

      <ChevronRight
        size={14}
        className="shrink-0 transition-colors duration-150"
        style={{ color: hovered ? color : "rgb(var(--muted-foreground) / 0.35)" }}
      />
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export interface PrototipoClientProps {
  userName: string;
  meetings: Meeting[];
}

export function PrototipoClient({ userName, meetings }: PrototipoClientProps) {
  const greeting = useMemo(getGreeting, []);
  const [query, setQuery] = useState("");
  const recent = meetings.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-14"
    >
      <div className="flex w-full max-w-2xl flex-col gap-6">

        {/* ── Heading ─────────────────────────────────────────────────────────── */}
        <h1 className="text-center text-[28px] font-bold tracking-tight text-foreground">
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

        {/* ── Claude-style chat input ──────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-shadow duration-300 focus-within:shadow-[0_0_0_2px_rgba(104,81,255,0.12),0_4px_32px_rgba(104,81,255,0.07)]">
          {/* Textarea area */}
          <div className="relative px-5 pb-2 pt-5">
            {query === "" && (
              <div className="pointer-events-none absolute left-5 top-5 text-[15px] text-muted-foreground/50">
                <AnimatedPlaceholder prompts={AI_PROMPTS} />
              </div>
            )}
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between border-t border-border/50 px-5 py-3">
            <span className="text-[11px] text-muted-foreground/40">
              Shift+Enter para nova linha
            </span>
            <button
              type="button"
              disabled={query.trim().length === 0}
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all duration-150 disabled:opacity-25 hover:bg-primary/90 active:scale-95"
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>

        {/* ── Recording pills ──────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          {RECORDING_MODES.map(({ key, ...rest }) => (
            <RecordingPill key={key} {...rest} />
          ))}
        </div>

        {/* ── Two-column: Recentes + Grupos ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-8 pt-2">

          {/* RECENTES */}
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <Clock size={10} />
              Recentes
            </p>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground/40">Nenhuma reunião ainda.</p>
            ) : (
              <ul className="space-y-0.5">
                {recent.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <span className="size-1.5 shrink-0 rounded-full bg-primary/40" />
                      <span className="truncate">{m.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* GRUPOS */}
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              ✦ Grupos
            </p>
            <p className="px-1.5 text-sm text-muted-foreground/40">
              Nenhum grupo ainda.
            </p>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
