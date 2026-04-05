"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Zap, MessageSquare, BarChart2 } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

// ── Mini dashboard mockup — mirrors the Figma "Dashboard Home" frame ──────────
function DashboardMockup() {
  const meetings = [
    {
      title: "Product Roadmap Q3",
      sub: "Alex, Sarah, +2",
      status: "Processando",
      dot: "bg-notura-primary",
      badge: "bg-[#6851FF]/15 text-[#6851FF]",
    },
    {
      title: "Client Discovery Call",
      sub: "Maria Santos",
      status: "No WhatsApp",
      dot: "bg-amber-500",
      badge: "bg-amber-500/20 text-amber-400",
    },
    {
      title: "Weekly Sync #14",
      sub: "Engineering Team",
      status: "Concluído",
      dot: "bg-notura-success",
      badge: "bg-notura-success/15 text-notura-success",
    },
  ];

  return (
    <div className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#2C285B] bg-[#141319] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[#2C285B]/60 bg-[#141319] px-5 py-3">
        <div>
          <p className="font-manrope text-sm font-bold tracking-[-0.5px] text-[#F4F4F6]">
            Meeting AI
          </p>
          <p className="text-[10px] text-[#9598A8]">Intelligent Summaries</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
          <div className="h-7 w-7 rounded-full bg-[#252230]" />
        </div>
      </div>

      {/* Page content */}
      <div className="space-y-4 bg-[#0C0B0E] p-5">
        {/* Welcome + CTA */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-manrope text-xl font-extrabold tracking-[-0.5px] text-[#F4F4F6]">
              Bem-vindo, User!
            </h3>
            <p className="mt-0.5 text-[11px] text-[#9598A8]">
              3 resumos de IA aguardando revis\u00e3o.
            </p>
          </div>
          <button className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#6851FF] to-[#8B7AFF] px-4 py-2 font-manrope text-[11px] font-bold text-white shadow-[0_6px_16px_rgba(104,81,255,0.3)]">
            + Nova Reunião
          </button>
        </div>

        {/* Stats bento */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Clock, label: "Tempo Total", value: "24h 15m" },
            { icon: Zap, label: "IA Geradas", value: "128" },
            { icon: MessageSquare, label: "WhatsApp", value: "42 Sent" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl bg-[#1D1B26] p-3">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#6851FF]/15">
                <Icon className="h-3.5 w-3.5 text-[#6851FF]" />
              </div>
              <p className="text-[10px] text-[#9598A8]">{label}</p>
              <p className="font-manrope text-sm font-extrabold text-[#F4F4F6]">{value}</p>
            </div>
          ))}
        </div>

        {/* Recent meetings */}
        <div>
          <p className="mb-2 font-manrope text-xs font-bold text-[#F4F4F6]">Reuni\u00f5es Recentes</p>
          <div className="space-y-0 divide-y divide-[#2C285B]/40">
            {meetings.map((m) => (
              <div key={m.title} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1D1B26]">
                    <BarChart2 className="h-3.5 w-3.5 text-[#9598A8]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#F4F4F6]">{m.title}</p>
                    <p className="text-[10px] text-[#9598A8]">{m.sub}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${m.badge}`}
                >
                  <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${m.dot}`} />
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Glassmorphism AI suggestion bar */}
        <div className="flex items-center gap-3 rounded-xl border border-[#2C285B]/60 bg-[#1D1B26] p-3 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex shrink-0 -space-x-2">
            {[0.15, 0.25, 0.35].map((opacity, i) => (
              <div
                key={i}
                className="h-7 w-7 rounded-full border-2 border-[#141319]"
                style={{ backgroundColor: `rgba(104,81,255,${opacity})` }}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-[#6851FF]">Sugest\u00e3o IA</p>
            <p className="truncate text-[10px] text-[#9598A8]">
              Agendar follow-up com a equipe de Engenharia para o Q3
            </p>
          </div>
          <button className="shrink-0 rounded-lg bg-[#6851FF] px-2.5 py-1.5 text-[9px] font-bold text-white">
            Ação
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#0C0B0E] px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pb-32 lg:pt-36">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-64 -top-64 h-[700px] w-[700px] rounded-full bg-[#6851FF]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#6851FF]/5 blur-3xl" />

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:gap-20">
        {/* ── Left: copy ──────────────────────────────────────────────────── */}
        <div className="flex-1 text-center lg:text-left">
          {/* Badge pill */}
          <motion.div
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#6851FF]/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#6851FF]"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={-1}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#6851FF]" />
            IA em português &middot; Resumos via WhatsApp
          </motion.div>

          {/* H1 */}
          <motion.h1
            className="font-manrope text-4xl font-extrabold leading-[1.1] tracking-[-0.02em] text-[#F4F4F6] sm:text-5xl lg:text-[3.5rem]"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Nunca mais perca o que foi{" "}
            <span className="bg-gradient-to-r from-[#6851FF] to-[#8B7AFF] bg-clip-text text-transparent">
              decidido em reunião
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mt-5 max-w-xl text-lg leading-relaxed text-[#9598A8] lg:text-xl"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Notura transcreve, resume e envia as tarefas direto no seu
            WhatsApp — em português, em minutos.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#6851FF] to-[#8B7AFF] px-8 py-3.5 font-manrope text-sm font-bold text-white shadow-[0_10px_15px_-3px_rgba(104,81,255,0.2),0_4px_6px_-4px_rgba(104,81,255,0.2)] transition-all hover:-translate-y-px hover:shadow-[0_14px_20px_-4px_rgba(104,81,255,0.3)]"
            >
              Começar grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="inline-flex items-center gap-2 rounded-xl bg-[#1D1B26] px-8 py-3.5 font-manrope text-sm font-bold text-[#9598A8] transition-all hover:bg-[#252230]">
              Ver demo
            </button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-3 lg:justify-start"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <div className="flex -space-x-2">
              {[0.15, 0.25, 0.38].map((opacity, i) => (
                <div
                  key={i}
                className="h-8 w-8 rounded-full border-2 border-[#0C0B0E]"
                style={{ backgroundColor: `rgba(104,81,255,${opacity})` }}
                />
              ))}
            </div>
            <p className="text-sm text-[#9598A8]">
              <span className="font-semibold text-[#F4F4F6]">+1.200 equipes</span> j\u00e1 usam o
              Notura
            </p>
          </motion.div>
        </div>

        {/* ── Right: product mockup ─────────────────────────────────────── */}
        <motion.div
          className="flex w-full flex-1 justify-center"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0, 0, 0.2, 1] }}
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}
