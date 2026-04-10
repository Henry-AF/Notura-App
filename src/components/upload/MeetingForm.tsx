"use client";

import React, { useEffect, useState } from "react";
import { User, MessageSquare, Loader2, Zap } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { validateMeetingDate } from "@/lib/meetings/meeting-date";
import {
  formatWhatsappNumberForDisplay,
  getWhatsappNumberValidationError,
  maskBrazilianPhoneInput,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  accountWhatsappNumber?: string;
}

type WhatsappNumberSource = "account" | "custom";

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";
const inputCls =
  "w-full appearance-none rounded-lg border border-input bg-background py-2.5 pr-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

function formatDateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingForm({
  onSubmit,
  onValidationError,
  isSubmitting,
  hasFile,
  accountWhatsappNumber = "",
}: MeetingFormProps) {
  const [clientName, setClientName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [selectedMeetingDate, setSelectedMeetingDate] = useState<Date | undefined>();
  const [whatsappSource, setWhatsappSource] = useState<WhatsappNumberSource>("account");
  const [customWhatsappNumber, setCustomWhatsappNumber] = useState("");
  const [hasTouchedWhatsappSource, setHasTouchedWhatsappSource] = useState(false);
  const [today] = useState(() => new Date());

  const accountWhatsappNumberNormalized = normalizeWhatsappNumber(
    accountWhatsappNumber
  );
  const hasAccountWhatsappNumber =
    formatWhatsappNumberForDisplay(accountWhatsappNumberNormalized).length > 0;
  const accountWhatsappDisplay = formatWhatsappNumberForDisplay(
    accountWhatsappNumberNormalized
  );

  useEffect(() => {
    if (!hasAccountWhatsappNumber && whatsappSource === "account") {
      setWhatsappSource("custom");
      return;
    }

    if (hasAccountWhatsappNumber && !hasTouchedWhatsappSource) {
      setWhatsappSource("account");
    }
  }, [hasAccountWhatsappNumber, hasTouchedWhatsappSource, whatsappSource]);

  const handleDateChange = (date: Date | undefined) => {
    setSelectedMeetingDate(date);
    setMeetingDate(date ? formatDateToYmd(date) : "");
  };

  const handleCustomWhatsappChange = (value: string) => {
    setCustomWhatsappNumber(maskBrazilianPhoneInput(value));
  };

  const selectedWhatsappRaw =
    whatsappSource === "account"
      ? accountWhatsappNumberNormalized
      : customWhatsappNumber;

  const selectedWhatsappNormalized = normalizeWhatsappNumber(selectedWhatsappRaw);

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
    const meetingDateError = validateMeetingDate(meetingDate);
    if (meetingDateError) {
      onValidationError(meetingDateError);
      return;
    }
    const whatsappError = getWhatsappNumberValidationError(selectedWhatsappRaw);
    if (whatsappError) {
      onValidationError(whatsappError);
      return;
    }
    onSubmit({
      clientName: clientName.trim(),
      meetingDate,
      whatsappNumber: selectedWhatsappNormalized,
    });
  };

  const disabled = !hasFile || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <h2 className="font-display text-[15px] font-bold text-foreground">
        Informações da Reunião
      </h2>

      {/* Client name */}
      <div>
        <label className={labelCls}>Nome do cliente</label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
        <DatePicker
          value={selectedMeetingDate}
          onChange={handleDateChange}
          placeholder="Selecione a data da reunião"
          maxDate={today}
        />
      </div>

      {/* WhatsApp number */}
      <div>
        <label className={labelCls}>Número WhatsApp para resumo</label>
        <Select
          value={whatsappSource}
          onValueChange={(value) => {
            setHasTouchedWhatsappSource(true);
            setWhatsappSource(value as WhatsappNumberSource);
          }}
        >
          <SelectTrigger className="h-10 rounded-lg border-input bg-background text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="animate-none">
            <SelectItem value="account" disabled={!hasAccountWhatsappNumber}>
              {hasAccountWhatsappNumber
                ? accountWhatsappDisplay
                : "Número da conta (não configurado)"}
            </SelectItem>
            <SelectItem value="custom">Número personalizado</SelectItem>
          </SelectContent>
        </Select>
        {whatsappSource === "custom" ? (
          <div className="relative">
            <MessageSquare className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={customWhatsappNumber}
              onChange={(event) =>
                handleCustomWhatsappChange(event.target.value)
              }
              className={`${inputCls} mt-2 pl-9`}
            />
          </div>
        ) : null}
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Enviaremos os insights e próximos passos automaticamente.
        </p>
      </div>

      {/* Submit button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 font-display text-[15px] font-bold text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
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
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          O processamento leva em média 2 a 5 minutos.
        </p>
      </div>
    </form>
  );
}
