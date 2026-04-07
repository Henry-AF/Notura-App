import Link from "next/link";

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-6 bg-surface">
      <div className="max-w-7xl mx-auto text-center lg:text-left flex flex-col lg:flex-row items-center gap-16">
        <div className="lg:w-1/2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold tracking-widest mb-6">
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: `'FILL' 1` }}
            >
              auto_awesome
            </span>
            INTELIGÊNCIA ARTIFICIAL GENERATIVA
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-on-surface mb-8 leading-[1.1]">
            Transforme suas reuniões em{" "}
            <span className="text-primary">inteligência acionável.</span>
          </h1>
          <p className="text-xl text-on-surface-variant leading-relaxed mb-10 max-w-2xl">
            O Notura grava, transcreve e resume suas reuniões automaticamente,
            enviando os pontos chave direto para o seu WhatsApp. Menos notas,
            mais execução.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link
              href="/signup"
              className="bg-primary text-on-primary px-8 py-4 rounded-full font-bold text-lg shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              Teste Grátis{" "}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <button className="bg-surface-container-high text-on-surface px-8 py-4 rounded-full font-bold text-lg hover:bg-surface-container-highest transition-all">
              Ver Demonstração
            </button>
          </div>
        </div>

        <div className="lg:w-1/2 relative">
          <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border border-outline-variant/20">
            <img
              className="w-full h-auto"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDGcKJHXxC1HuQopsAPfam5dASSz8dVn4mjc64KbeQZunv-5paxNpxwVM6d6GOQ0WNW5c1PRVQRorvfc-Vd7DVHbNjSbb8n18MWSL3rCn7vnA2xJstqc9n8DWKbvvXxRQplOty4xIil3wXos_wUwjoVzGt6naxaCXudi0mByo82_B6DmGJ2WlLPZ4QZYFf8mV2ZeJmWPhpU5WitBvvqejqk6zR784Y3vlGYKaXFS4tYAgxA8K6Jxdebink0LYhv2_T34QcqepjVb5Q"
              alt="Dashboard do Notura mostrando transcrição com IA, resumo de reunião e interface de tarefas"
            />
          </div>
          {/* Floating notification */}
          <div className="absolute -bottom-6 -right-6 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-xl z-20 border border-outline-variant/10 hidden md:block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: `'FILL' 1` }}
                >
                  check_circle
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface">Resumo enviado!</p>
                <p className="text-[10px] text-on-surface-variant">WhatsApp • Agora mesmo</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
