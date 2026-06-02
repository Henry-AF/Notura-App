"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Monitor, Upload, ArrowRight, Clock, Sparkles } from "lucide-react";
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
  { key: "presencial", icon: Mic,     label: "Gravação Presencial",  color: "#6851FF" },
  { key: "remota",     icon: Monitor, label: "Gravação Remota",       color: "#059669" },
  { key: "upload",     icon: Upload,  label: "Enviar Arquivo",        color: "#D97706" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
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
      className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6"
    >
      {/* ── Logo mark ───────────────────────────────────────────────────────── */}
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles size={20} />
      </div>

      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      <h1 className="mb-6 text-[28px] font-bold tracking-tight text-foreground">
        {greeting},{" "}
        <GradientText
          colors={["#7C3AED", "#A855F7", "#C084FC", "#A855F7", "#7C3AED"]}
          animationSpeed={4}
          showBorder={false}
        >
          {userName}
        </GradientText>
      </h1>

      {/* ── Search input ─────────────────────────────────────────────────────── */}
      <div className="relative mb-10 w-full max-w-xl">
        <div className="flex h-11 w-full items-center gap-3 rounded-lg border border-border bg-card px-4 shadow-sm transition-shadow focus-within:shadow-[0_0_0_2px_rgba(104,81,255,0.15)]">
          {/* Placeholder or typed text */}
          <div className="flex-1 overflow-hidden text-sm">
            {query === "" ? (
              <span className="text-muted-foreground/60">
                <AnimatedPlaceholder prompts={AI_PROMPTS} />
              </span>
            ) : null}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="absolute inset-0 w-full bg-transparent px-4 text-sm text-foreground outline-none"
              style={{ caretColor: "rgb(var(--primary))" }}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            />
          </div>

          {/* Right hint */}
          <span className="shrink-0 text-xs text-muted-foreground/40">Enter para enviar</span>
          <ArrowRight size={14} className="shrink-0 text-muted-foreground/40" />
        </div>
      </div>

      {/* ── Three-column section ─────────────────────────────────────────────── */}
      <div className="grid w-full max-w-2xl grid-cols-3 gap-8">

        {/* GRAVAR */}
        <div>
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <Mic size={10} />
            Gravar
          </p>
          <ul className="space-y-0.5">
            {RECORDING_MODES.map(({ key, icon: Icon, label, color }) => (
              <li key={key}>
                <button
                  type="button"
                  className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon size={13} style={{ color, flexShrink: 0 }} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>

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

        {/* GRUPOS / placeholder */}
        <div>
          <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            ✦ Grupos
          </p>
          <p className="px-1.5 text-sm text-muted-foreground/40">
            Nenhum grupo ainda.
          </p>
        </div>

      </div>
    </motion.div>
  );
}
