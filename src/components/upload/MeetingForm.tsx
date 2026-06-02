"use client";

import React, { useEffect, useMemo, useReducer } from "react";
import { MessageSquare, Loader2, Zap } from "lucide-react";
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
  meetingDate: string;
  whatsappNumber: string;
}

interface MeetingFormProps {
  onSubmit: (data: MeetingFormData) => void;
  onValidationError: (message: string) => void;
  isSubmitting: boolean;
  hasFile: boolean;
  accountWhatsappNumber?: string;
  canSendWhatsAppSummary?: boolean;
  fileField?: React.ReactNode;
}

type WhatsappNumberSource = "account" | "custom";

type MeetingFormState = {
  meetingDate: string;
  selectedMeetingDate: Date | undefined;
  whatsappSource: WhatsappNumberSource;
  customWhatsappNumber: string;
  hasTouchedWhatsappSource: boolean;
};

type MeetingFormAction =
  | { type: "dateChanged"; date: Date | undefined }
  | { type: "whatsappSourceChanged"; value: WhatsappNumberSource }
  | { type: "customWhatsappChanged"; value: string }
  | { type: "accountSourceSelected" }
  | { type: "customSourceSelected" };

const initialMeetingFormState: MeetingFormState = {
  meetingDate: "",
  selectedMeetingDate: undefined,
  whatsappSource: "account",
  customWhatsappNumber: "",
  hasTouchedWhatsappSource: false,
};

function meetingFormReducer(
  state: MeetingFormState,
  action: MeetingFormAction
): MeetingFormState {
  switch (action.type) {
    case "dateChanged":
      return {
        ...state,
        selectedMeetingDate: action.date,
        meetingDate: action.date ? formatDateToYmd(action.date) : "",
      };
    case "whatsappSourceChanged":
      return {
        ...state,
        whatsappSource: action.value,
        hasTouchedWhatsappSource: true,
      };
    case "customWhatsappChanged":
      return {
        ...state,
        customWhatsappNumber: maskBrazilianPhoneInput(action.value),
      };
    case "accountSourceSelected":
      return { ...state, whatsappSource: "account" };
    case "customSourceSelected":
      return { ...state, whatsappSource: "custom" };
  }
}

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
  canSendWhatsAppSummary = true,
  fileField,
}: MeetingFormProps) {
  const [state, dispatch] = useReducer(
    meetingFormReducer,
    initialMeetingFormState
  );
  const {
    meetingDate,
    selectedMeetingDate,
    whatsappSource,
    customWhatsappNumber,
    hasTouchedWhatsappSource,
  } = state;
  const today = useMemo(() => new Date(), []);

  const accountWhatsappNumberNormalized = normalizeWhatsappNumber(
    accountWhatsappNumber
  );
  const hasAccountWhatsappNumber =
    formatWhatsappNumberForDisplay(accountWhatsappNumberNormalized).length > 0;
  const accountWhatsappDisplay = formatWhatsappNumberForDisplay(
    accountWhatsappNumberNormalized
  );

  useEffect(() => {
    if (!canSendWhatsAppSummary) return;

    if (!hasAccountWhatsappNumber && whatsappSource === "account") {
      dispatch({ type: "customSourceSelected" });
      return;
    }

    if (hasAccountWhatsappNumber && !hasTouchedWhatsappSource) {
      dispatch({ type: "accountSourceSelected" });
    }
  }, [
    canSendWhatsAppSummary,
    hasAccountWhatsappNumber,
    hasTouchedWhatsappSource,
    whatsappSource,
  ]);

  const handleDateChange = (date: Date | undefined) => {
    dispatch({ type: "dateChanged", date });
  };

  const handleCustomWhatsappChange = (value: string) => {
    dispatch({ type: "customWhatsappChanged", value });
  };

  const selectedWhatsappRaw =
    whatsappSource === "account"
      ? accountWhatsappNumberNormalized
      : customWhatsappNumber;

  const selectedWhatsappNormalized = normalizeWhatsappNumber(selectedWhatsappRaw);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingDate) {
      onValidationError("Selecione a data da reunião.");
      return;
    }
    const meetingDateError = validateMeetingDate(meetingDate);
    if (meetingDateError) {
      onValidationError(meetingDateError);
      return;
    }
    if (canSendWhatsAppSummary) {
      const whatsappError = getWhatsappNumberValidationError(selectedWhatsappRaw);
      if (whatsappError) {
        onValidationError(whatsappError);
        return;
      }
    }
    onSubmit({
      meetingDate,
      whatsappNumber: canSendWhatsAppSummary ? selectedWhatsappNormalized : "",
    });
  };

  const disabled = !hasFile || isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <h2 className="font-display text-[15px] font-bold text-foreground">
        Informações da Reunião
      </h2>

      {fileField ? <div>{fileField}</div> : null}

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

      {canSendWhatsAppSummary ? (
        <div>
          <label className={labelCls}>Número WhatsApp para resumo</label>
          <Select
            value={whatsappSource}
            onValueChange={(value) => {
              dispatch({
                type: "whatsappSourceChanged",
                value: value as WhatsappNumberSource,
              });
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
              <MessageSquare className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
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
      ) : null}

      {/* Submit button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 font-display text-[15px] font-bold text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              Processar reunião <Zap className="size-4" />
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
