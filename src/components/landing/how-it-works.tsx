"use client";

const steps = [
  {
    icon: "mic",
    step: "PASSO 01",
    title: "Gravar",
    description:
      "Captura de áudio cristalina de qualquer plataforma (Zoom, Meet, Presencial).",
  },
  {
    icon: "translate",
    step: "PASSO 02",
    title: "Transcrever",
    description:
      "Nossa IA transcreve cada palavra com 98% de precisão em tempo real.",
  },
  {
    icon: "auto_fix_high",
    step: "PASSO 03",
    title: "Resumir",
    description:
      "Extração automática de pontos chave, decisões e próximos passos.",
  },
  {
    icon: "chat_bubble",
    step: "PASSO 04",
    title: "Enviar",
    description:
      "Receba o resumo estruturado instantaneamente no seu WhatsApp.",
  },
  {
    icon: "dashboard",
    step: "PASSO 05",
    title: "Gerenciar",
    description:
      "Acompanhe tarefas e prazos no seu dashboard inteligente Notura.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-surface-container-low" id="como-funciona">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4 text-on-surface">
            Fluxo de Trabalho Inteligente
          </h2>
          <p className="text-on-surface-variant text-lg">
            Deixe o Notura cuidar de toda a carga cognitiva das suas reuniões.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {steps.map((step) => (
            <div
              key={step.step}
              className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10 flex flex-col items-start transition-transform hover:-translate-y-2"
            >
              <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined">{step.icon}</span>
              </div>
              <span className="text-[10px] font-bold tracking-widest text-primary mb-2">
                {step.step}
              </span>
              <h3 className="text-xl font-bold mb-3 text-on-surface">{step.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
