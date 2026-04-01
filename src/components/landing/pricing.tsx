"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "R$0",
    period: "",
    description: "Para experimentar sem compromisso",
    features: [
      "3 reuniões por mês",
      "Transcrição completa",
      "Resumo por email",
      "Exportar PDF",
    ],
    cta: "Começar grátis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "R$79",
    period: "/mês",
    description: "Para profissionais que vivem de reunião",
    features: [
      "30 reuniões por mês",
      "Entrega via WhatsApp",
      "Extração de tarefas e prazos",
      "Integração Zoom",
      "Suporte prioritário",
    ],
    cta: "Assinar Pro",
    highlighted: true,
  },
  {
    name: "Equipe",
    price: "R$49",
    period: "/usuário/mês",
    description: "Para times que precisam estar alinhados",
    features: [
      "Reuniões ilimitadas",
      "Tudo do Pro",
      "Dashboard da equipe",
      "Tarefas compartilhadas",
      "Relatórios mensais",
    ],
    cta: "Falar com vendas",
    highlighted: false,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export function Pricing() {
  return (
    <section className="bg-notura-bg px-4 py-24 sm:px-6 lg:px-8" id="pricing">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          className="text-center font-display text-3xl font-bold text-notura-ink sm:text-4xl"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          Planos simples, sem surpresas
        </motion.h2>
        <motion.p
          className="mx-auto mt-3 max-w-lg text-center text-notura-secondary"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          Comece grátis e faça upgrade quando precisar.
        </motion.p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
            >
              <Card
                className={cn(
                  "relative h-full flex flex-col",
                  plan.highlighted &&
                    "border-violet-400 shadow-glow ring-1 ring-violet-200"
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-notura-primary px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap">
                    Mais popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-notura-ink">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-notura-secondary">{plan.period}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-notura-secondary">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-notura-ink">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.highlighted ? "default" : "secondary"}
                    className="mt-6 w-full"
                    asChild
                  >
                    <Link href="/signup">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
