"use client";

import React, { useState } from "react";
import { User, Calendar, MessageSquare, Loader2, Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeetingFormData {
  clientName: string;
  meetingDate: string;
  whatsappNumber: string;
}

interface MeetingFormProps {
  onSubmit: (data: MeetingFormData) => void;
  onValidationError: (message: string) => void;
  isSubmitting: boolean;
  hasFile: boolean;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#6b7280]";
const inputCls =
  "w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white py-2.5 pr-3.5 text-sm text-[#191c1e] outline-none placeholder-[#9ca3af] transition-colors focus:border-[#6851FF] focus:ring-2 focus:ring-[#6851FF]/10";

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingForm({
  onSubmit,
  onValidationError,
  isSubmitting,
  hasFile,
}: MeetingFormProps) {
  const [clientName, setClientName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      onValidationError("Preencha o nome do cliente.");
      return;
    }
    if (!meetingDate) {
      onValidationError("Selecione a data da reunião.");
      return;
    }
    if (!whatsappNumber.trim()) {
      onValidationError("Preencha o número de WhatsApp para receber o resumo.");
      return;
    }
    onSubmit({ clientName: clientName.trim(), meetingDate, whatsappNumber: whatsappNumber.trim() });
  };

  const disabled = !hasFile || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <h2 className="font-display text-[15px] font-bold text-[#191c1e]">
        Informações da Reunião
      </h2>

      {/* Client name */}
      <div>
        <label className={labelCls}>Nome do cliente</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            placeholder="Ex: Tech Solutions Inc."
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {/* Meeting date */}
      <div>
        <label className={labelCls}>Data da reunião</label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className={`${inputCls} pl-9`}
            style={{ colorScheme: "light" }}
          />
        </div>
      </div>

      {/* WhatsApp number */}
      <div>
        <label className={labelCls}>Número WhatsApp para resumo</label>
        <div className="relative">
          <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="tel"
            placeholder="+55 (00) 00000-0000"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-[#9ca3af]">
          Enviaremos os insights e próximos passos automaticamente.
        </p>
      </div>

      {/* Submit button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-display text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          style={disabled ? {} : { background: isSubmitting ? "#5740EE" : "#6851FF" }}
          onMouseEnter={(e) => {
            if (!disabled)
              (e.currentTarget as HTMLButtonElement).style.background = "#5740EE";
          }}
          onMouseLeave={(e) => {
            if (!disabled)
              (e.currentTarget as HTMLButtonElement).style.background = "#6851FF";
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              Processar reunião <Zap className="h-4 w-4" />
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-[#9ca3af]">
          O processamento leva em média 2 a 5 minutos.
        </p>
      </div>
    </form>
  );
}
