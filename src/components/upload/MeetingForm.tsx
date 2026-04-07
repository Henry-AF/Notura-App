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
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[#606060]";
const inputCls =
  "w-full appearance-none rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] py-2.5 pr-3.5 text-sm text-white outline-none placeholder-[#606060] transition-colors focus:border-[#6851FF]";

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
      <h2 className="font-display text-[15px] font-bold text-white">
        Informações da Reunião
      </h2>

      {/* Client name */}
      <div>
        <label className={labelCls}>Nome do cliente</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#606060]" />
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
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#606060]" />
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className={`${inputCls} pl-9`}
            style={{ colorScheme: "dark" }}
          />
        </div>
      </div>

      {/* WhatsApp number */}
      <div>
        <label className={labelCls}>Número WhatsApp para resumo</label>
        <div className="relative">
          <MessageSquare className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#606060]" />
          <input
            type="tel"
            placeholder="+55 (00) 00000-0000"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-[#606060]">
          Enviaremos os insights e próximos passos automaticamente.
        </p>
      </div>

      {/* Submit button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-display text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#333333] disabled:text-[#606060]"
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
        <p className="mt-2 text-center text-[11px] text-[#606060]">
          O processamento leva em média 2 a 5 minutos.
        </p>
      </div>
    </form>
  );
}
