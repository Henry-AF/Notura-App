"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppMockup } from "./whatsapp-mockup";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-24 lg:pt-32">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:gap-16">
        {/* Text */}
        <div className="flex-1 text-center lg:text-left">
          <motion.h1
            className="font-display text-4xl font-semibold leading-tight text-notura-ink sm:text-5xl lg:text-[3.25rem]"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
          >
            Nunca mais perca o que foi decidido em reunião
          </motion.h1>
          <motion.p
            className="mt-5 max-w-xl text-lg text-notura-muted lg:text-xl"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Notura transcreve, resume e envia as tarefas direto no seu
            WhatsApp — em português, em minutos.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            <Button asChild size="lg">
              <Link href="/signup">
                Começar grátis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg">
              Ver demo
            </Button>
          </motion.div>
        </div>

        {/* WhatsApp mockup */}
        <motion.div
          className="flex-1 flex justify-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
        >
          <WhatsAppMockup />
        </motion.div>
      </div>
    </section>
  );
}
