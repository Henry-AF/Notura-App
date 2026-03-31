"use client";

import { motion } from "framer-motion";
import { Mic, Activity, MessageCircle } from "lucide-react";

const steps = [
  {
    icon: Mic,
    title: "Conecta",
    description:
      "Faça upload do áudio da reunião ou conecte diretamente ao Google Meet.",
  },
  {
    icon: Activity,
    title: "Processa",
    description:
      "Nossa IA transcreve e extrai decisões, tarefas e prazos automaticamente.",
  },
  {
    icon: MessageCircle,
    title: "Recebe",
    description:
      "O resumo chega no seu WhatsApp em minutos, pronto para compartilhar.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export function HowItWorks() {
  return (
    <section className="bg-notura-bg px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          className="text-center font-display text-3xl font-bold text-notura-ink sm:text-4xl"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          Como funciona
        </motion.h2>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              className="flex flex-col items-center text-center"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <div className="relative mb-2">
                <span className="font-display text-6xl font-extrabold text-violet-100 select-none">
                  0{i + 1}
                </span>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 shadow-sm">
                <step.icon className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-notura-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-notura-secondary">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
