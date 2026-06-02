"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mic,
  Monitor,
  Upload,
  ArrowUp,
  Plus,
  SlidersHorizontal,
  Clock,
} from "lucide-react";
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

const SUBTITLES = [
  "O que analisamos hoje?",
  "Qual reunião quer explorar?",
  "Sobre o que quer saber?",
];

const RECORDING_MODES = [
  { key: "presencial", icon: Mic,     label: "Gravação Presencial",  color: "#6851FF" },
  { key: "remota",     icon: Monitor, label: "Gravação Remota",       color: "#059669" },
  { key: "upload",     icon: Upload,  label: "Enviar Arquivo",        color: "#D97706" },
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

// ─── AnimatedSubtitle ─────────────────────────────────────────────────────────

function AnimatedSubtitle({ subtitles }: { subtitles: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % subtitles.length),
      5000
    );
    return () => clearInterval(id);
  }, [subtitles.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="inline-block"
      >
        {subtitles[index]}
      </motion.span>
    </AnimatePresence>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="px-8 pb-20 pt-16"
    >
      <div className="mx-auto w-full max-w-[680px]">

        {/* ── Two-line heading ────────────────────────────────────────────────── */}
        <div className="mb-7 leading-tight">
          <h1 className="text-[38px] font-bold tracking-tight text-foreground">
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
          <h2 className="text-[38px] font-bold tracking-tight text-muted-foreground/45">
            <AnimatedSubtitle subtitles={SUBTITLES} />
          </h2>
        </div>

        {/* ── Input ───────────────────────────────────────────────────────────── */}
        <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-200 focus-within:shadow-[0_0_0_2px_rgba(104,81,255,0.13)]">
          {/* Textarea */}
          <div className="relative px-5 pb-1 pt-5">
            {query === "" && (
              <div className="pointer-events-none absolute left-5 top-5 text-[15px] text-muted-foreground/50">
                <AnimatedPlaceholder prompts={AI_PROMPTS} />
              </div>
            )}
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center gap-2 px-4 pb-3 pt-1">
            {/* Left actions */}
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <SlidersHorizontal size={14} />
            </button>

            <div className="flex-1" />

            {/* Send */}
            <button
              type="button"
              disabled={query.trim().length === 0}
              className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background shadow-sm transition-all duration-150 disabled:opacity-20 hover:opacity-80 active:scale-95"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>

        {/* ── Recording chips ──────────────────────────────────────────────────── */}
        <div className="mb-10 flex flex-wrap gap-2">
          {RECORDING_MODES.map(({ key, icon: Icon, label, color }) => (
            <button
              key={key}
              type="button"
              className="group flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground/70 shadow-sm transition-all duration-150 hover:border-border/0 hover:bg-accent hover:text-foreground active:scale-[0.97]"
            >
              <Icon size={13} style={{ color }} />
              {label}
            </button>
          ))}
        </div>

        {/* ── PostHog two-column ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-10">

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
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
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
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              ✦ Grupos
            </p>
            <p className="px-1.5 text-[13px] text-muted-foreground/40">
              Nenhum grupo ainda.
            </p>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
