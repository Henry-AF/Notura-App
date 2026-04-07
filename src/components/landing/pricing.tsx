"use client";

import Link from "next/link";

export function Pricing() {
  return (
    <section className="py-24 bg-surface-container-low" id="precos">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 text-on-surface">
            Planos que crescem com você
          </h2>
          <p className="text-on-surface-variant">
            Comece grátis e escale quando precisar.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Starter */}
          <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 flex flex-col">
            <h3 className="text-xl font-bold mb-2 text-on-surface">Starter</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black text-on-surface">R$ 0</span>
              <span className="text-on-surface-variant">/mês</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-center gap-3 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-lg">check</span>
                3 reuniões / mês
              </li>
              <li className="flex items-center gap-3 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-lg">check</span>
                Transcrição com IA
              </li>
              <li className="flex items-center gap-3 text-sm text-on-surface-variant/60">
                <span className="material-symbols-outlined text-lg">check</span>
                Extração de Tarefas
              </li>
              <li className="flex items-center gap-3 text-sm text-on-surface-variant/60">
                <span className="material-symbols-outlined text-lg">close</span>
                Integração WhatsApp
              </li>
              
            </ul>
            <Link
              href="/signup"
              className="w-full py-3 rounded-full border-2 border-outline-variant font-bold hover:bg-surface-container transition-all text-center text-on-surface"
            >
              Começar Grátis
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-primary text-on-primary p-10 rounded-3xl shadow-2xl scale-105 relative z-10 flex flex-col">
            <div className="absolute top-4 right-6 bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold px-2 py-1 rounded">
              POPULAR
            </div>
            <h3 className="text-xl font-bold mb-2">Pro</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">R$ 59</span>
              <span className="text-on-primary/80">/mês</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-lg">check</span>
                30 Reuniões / mês
              </li>
              <li className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-lg">check</span>
                Transcrição com IA
              </li>
              <li className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-lg">check</span>
                Resumo via WhatsApp
              </li>
              <li className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-lg">check</span>
                Tarefas e Decisões
              </li>
              <li className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-lg">check</span>
                Exportação em PDF
              </li>
              <li className="flex items-center gap-3 text-sm">
                <span className="material-symbols-outlined text-lg">check</span>
                Suporte Prioritário
              </li>
            </ul>
            <Link
              href="/signup"
              className="w-full py-4 rounded-full bg-white text-primary font-black shadow-lg hover:opacity-90 transition-all text-center"
            >
              Assinar Agora
            </Link>
          </div>

          {/* Enterprise */}
          <div className="bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 flex flex-col">
            <h3 className="text-xl font-bold mb-2 text-on-surface">Enterprise</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black">R$ 99</span>
              <span className="text-on-primary/80">/mês</span>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              <li className="flex items-center gap-3 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-lg">check</span>
                Reuniões Ilimitadas
              </li>
              <li className="flex items-center gap-3 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-lg">check</span>
                Todos os recursos do plano Pro
              </li>
              <li className="flex items-center gap-3 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-lg">check</span>
                Múltiliplos usuários e equipes
              </li>
              <li className="flex items-center gap-3 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-lg">check</span>
                Dashboards
              </li>
              <li className="flex items-center gap-3 text-sm text-on-surface">
                <span className="material-symbols-outlined text-primary text-lg">check</span>
                Integrações
              </li>
            </ul>
            <button className="w-full py-3 rounded-full border-2 border-outline-variant font-bold hover:bg-surface-container transition-all text-on-surface">
              Falar com Vendas
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

