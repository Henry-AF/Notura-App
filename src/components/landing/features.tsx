import Link from "next/link";

export function Features() {
  return (
    <section className="py-24 bg-surface" id="funcionalidades">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row justify-between items-end gap-6 mb-16">
          <div className="lg:w-2/3">
            <h2 className="text-4xl font-bold tracking-tight mb-6 text-on-surface">
              Tudo o que você precisa para dominar suas reuniões
            </h2>
            <p className="text-on-surface-variant text-lg">
              Funcionalidades desenhadas para profissionais que valorizam cada segundo do seu dia.
            </p>
          </div>
          <Link
            href="/signup"
            className="text-primary font-bold flex items-center gap-2 group hover:opacity-80 transition-opacity"
          >
            Conheça todos os recursos{" "}
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1 – Transcription */}
          <div className="md:col-span-7 bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="inline-block px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold mb-6">
                IA
              </div>
              <h3 className="text-2xl font-bold mb-4 text-on-surface">
                Transcrição em Tempo Real
              </h3>
              <p className="text-on-surface-variant mb-8 max-w-md">
                Esqueça a pressa para anotar. O Notura transcreve cada fala identificando diferentes
                oradores automaticamente, com suporte a mais de 50 idiomas.
              </p>
            </div>
            <div className="absolute -bottom-10 -right-10 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-[200px] text-on-surface">
                edit_note
              </span>
            </div>
          </div>

          {/* Card 2 – AI Summaries */}
          <div className="md:col-span-5 bg-primary text-on-primary p-10 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="inline-block px-3 py-1 rounded-full bg-on-primary/20 text-on-primary text-[10px] font-bold mb-6">
              PRODUTIVIDADE
            </div>
            <h3 className="text-2xl font-bold mb-4">Resumos com IA</h3>
            <p className="text-on-primary/80">
              Receba um resumo executivo destilado. Identificamos as decisões cruciais para que você
              não precise ouvir 1h de áudio novamente.
            </p>
          </div>

          {/* Card 3 – Task Extraction */}
          <div className="md:col-span-5 bg-surface-container-high p-10 rounded-3xl shadow-sm">
            <div className="inline-block px-3 py-1 rounded-full bg-primary-container/20 text-primary text-[10px] font-bold mb-6">
              FOCO
            </div>
            <h3 className="text-2xl font-bold mb-4 text-on-surface">Extração de Tarefas</h3>
            <p className="text-on-surface-variant">
              O sistema detecta automaticamente compromissos e atribui responsáveis, criando uma
              lista de tarefas pronta para ser executada.
            </p>
          </div>

          {/* Card 4 – WhatsApp */}
          <div className="md:col-span-7 bg-surface-container-lowest p-10 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="inline-block px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold mb-6">
                WHATSAPP
              </div>
              <h3 className="text-2xl font-bold mb-4 text-on-surface">Integração WhatsApp</h3>
              <p className="text-on-surface-variant">
                Sem necessidade de novos apps. Seus resumos chegam onde você já está. Responda ao
                bot para tirar dúvidas sobre a reunião.
              </p>
            </div>
            <div className="w-32 h-32 bg-surface-container flex items-center justify-center rounded-2xl shrink-0">
              <span className="material-symbols-outlined text-5xl text-primary">send</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
