import { Check } from "lucide-react";

export function WhatsAppMockup() {
  return (
    <div className="w-full max-w-sm">
      {/* Phone frame */}
      <div className="rounded-2xl border border-[#F3F4F6] bg-[#ECE5DD] p-3 shadow-xl animate-float">
          <div className="flex items-center gap-3 rounded-t-xl bg-[#075E54] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="white" fillOpacity="0.3" />
              <path d="M12 30V10L21 22V10" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="28" cy="20" r="5" fill="white" opacity="0.9" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Notura</p>
            <p className="text-xs text-white/70">online</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="space-y-2 px-2 py-3">
          {/* Message bubble */}
          <div className="max-w-[95%] rounded-lg rounded-tl-none bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#075E54]">Notura</p>
            <div className="mt-1.5 space-y-2 text-[13px] leading-relaxed text-gray-800">
              <p className="font-semibold">Reunião: Alinhamento RH — 19/03</p>
              <p className="text-gray-600">Duração: 47 min | 4 participantes</p>
              <div className="border-l-2 border-[#075E54] pl-2 mt-2">
                <p className="font-medium text-[#075E54]">Decisões:</p>
                <p>1. Aprovar novo plano de cargos e salários</p>
                <p>2. Manter formato híbrido até julho</p>
              </div>
              <div className="border-l-2 border-amber-500 pl-2">
                <p className="font-medium text-amber-600">Tarefas:</p>
                <p>1. Ana — Enviar proposta até 22/03</p>
                <p>2. Carlos — Agendar treinamento equipe</p>
                <p>3. Lúcia — Revisar política de férias</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1">
              <span className="text-[10px] text-gray-400">14:32</span>
              <Check className="h-3 w-3 text-[#53BDEB]" />
              <Check className="-ml-1.5 h-3 w-3 text-[#53BDEB]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
