"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const segments = ["RH", "Jurídico", "Administrativo"];

const testimonials = [
  {
    name: "Carla Mendes",
    role: "Gestora de RH",
    company: "TechNova",
    quote:
      "Antes eu levava 40 minutos anotando tudo depois da reunião. Agora o resumo chega no meu WhatsApp antes de eu sair da sala.",
  },
  {
    name: "Dr. Rafael Costa",
    role: "Advogado",
    company: "Costa & Associados",
    quote:
      "A precisão nas decisões e prazos é impressionante. Minha equipe confia no Notura para não perder nenhum compromisso.",
  },
  {
    name: "Patrícia Lima",
    role: "Coordenadora Administrativa",
    company: "Grupo Horizonte",
    quote:
      "Simples de usar, sem curva de aprendizado. Até meu diretor de 60 anos usa sem reclamar.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export function SocialProof() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Segment badges */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-sm text-notura-secondary">Usado por profissionais de</span>
          {segments.map((seg) => (
            <Badge key={seg} variant="default">
              {seg}
            </Badge>
          ))}
        </motion.div>

        {/* Testimonials */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
            >
              <Card className="h-full">
                <CardContent className="pt-6">
                  <p className="text-sm leading-relaxed text-notura-ink">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback name={t.name} />
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-notura-ink">{t.name}</p>
                      <p className="text-xs text-notura-secondary">
                        {t.role}, {t.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
