"use client";

import React, { useEffect, useState } from "react";
import {
  Loader2,
  MessageSquare,
  Mic,
  MonitorUp,
  UploadCloud,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SegmentedControlOption } from "@/components/ui/segmented-control";
import { validateMeetingDate } from "@/lib/meetings/meeting-date";
import { getRecordingTheme } from "./recording-theme";
import {
  formatWhatsappNumberForDisplay,
  getWhatsappNumberValidationError,
  maskBrazilianPhoneInput,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";

type WhatsappNumberSource = "account" | "custom";
export type RecordingMode = "in-person" | "remote" | "upload";

export interface RecordingSetupValues {
  clientName: string;
  whatsappNumber: string;
  recordingMode: RecordingMode;
  meetingDate?: string;
}

interface RecordingSetupCardProps {
  accountWhatsappNumber?: string;
  canSendWhatsAppSummary?: boolean;
  isStarting: boolean;
  hasUploadFile?: boolean;
  recordingMode: RecordingMode;
  onRecordingModeChange: (mode: RecordingMode) => void;
  onStart: (values: RecordingSetupValues) => void;
  onValidationError: (message: string) => void;
  uploadField?: React.ReactNode;
}

const RECORDING_MODE_OPTIONS: SegmentedControlOption<RecordingMode>[] = [
  { value: "in-person", label: "Presencial", icon: <Mic className="h-3.5 w-3.5" /> },
  { value: "remote", label: "Remota", icon: <MonitorUp className="h-3.5 w-3.5" /> },
  { value: "upload", label: "Upload", icon: <UploadCloud className="h-3.5 w-3.5" /> },
];

const labelClassName =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";

export function RecordingSetupCard({
  accountWhatsappNumber = "",
  canSendWhatsAppSummary = true,
  isStarting,
  hasUploadFile = false,
  recordingMode,
  onRecordingModeChange,
  onStart,
  onValidationError,
  uploadField,
}: RecordingSetupCardProps) {
  const [clientName, setClientName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [selectedMeetingDate, setSelectedMeetingDate] = useState<Date | undefined>();
  const [whatsappSource, setWhatsappSource] =
    useState<WhatsappNumberSource>("account");
  const [customWhatsappNumber, setCustomWhatsappNumber] = useState("");
  const [hasTouchedWhatsappSource, setHasTouchedWhatsappSource] = useState(false);
  const [today] = useState(() => new Date());

  const accountWhatsappNumberNormalized = normalizeWhatsappNumber(
    accountWhatsappNumber
  );
  const accountWhatsappDisplay = formatWhatsappNumberForDisplay(
    accountWhatsappNumberNormalized
  );
  const hasAccountWhatsappNumber = accountWhatsappDisplay.length > 0;

  useEffect(() => {
    if (!canSendWhatsAppSummary) return;

    if (!hasAccountWhatsappNumber && whatsappSource === "account") {
      setWhatsappSource("custom");
      return;
    }

    if (hasAccountWhatsappNumber && !hasTouchedWhatsappSource) {
      setWhatsappSource("account");
    }
  }, [
    canSendWhatsAppSummary,
    hasAccountWhatsappNumber,
    hasTouchedWhatsappSource,
    whatsappSource,
  ]);

  const selectedWhatsappRaw =
    whatsappSource === "account"
      ? accountWhatsappNumberNormalized
      : customWhatsappNumber;

  function formatDateToYmd(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function handleDateChange(date: Date | undefined) {
    setSelectedMeetingDate(date);
    setMeetingDate(date ? formatDateToYmd(date) : "");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!clientName.trim()) {
      onValidationError("Preencha o nome do cliente.");
      return;
    }

    if (canSendWhatsAppSummary) {
      const whatsappError = getWhatsappNumberValidationError(selectedWhatsappRaw);
      if (whatsappError) {
        onValidationError(whatsappError);
        return;
      }
    }

    if (isUploadMode && !hasUploadFile) {
      onValidationError("Selecione um arquivo para processar.");
      return;
    }

    if (isUploadMode && !meetingDate) {
      onValidationError("Selecione a data da reunião.");
      return;
    }

    if (isUploadMode) {
      const meetingDateError = validateMeetingDate(meetingDate);
      if (meetingDateError) {
        onValidationError(meetingDateError);
        return;
      }
    }

    onStart({
      clientName: clientName.trim(),
      whatsappNumber: canSendWhatsAppSummary
        ? normalizeWhatsappNumber(selectedWhatsappRaw)
        : "",
      recordingMode,
      meetingDate: isUploadMode ? meetingDate : undefined,
    });
  }

  const isRemoteRecording = recordingMode === "remote";
  const isUploadMode = recordingMode === "upload";
  const StartIcon = isRemoteRecording
    ? MonitorUp
    : isUploadMode
      ? UploadCloud
      : Mic;
  const theme = getRecordingTheme(recordingMode);

  return (
    <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-base font-semibold text-card-foreground">
          Informações da gravação
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isUploadMode
            ? "Selecione o arquivo, informe os dados da reunião e inicie o processamento."
            : canSendWhatsAppSummary
              ? "Defina quem vai receber o sumário e inicie a gravação quando estiver tudo pronto."
              : "Informe os dados da reunião e inicie a gravação quando estiver tudo pronto."}
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className={labelClassName}>Modo da reunião</label>
            <SegmentedControl
              options={RECORDING_MODE_OPTIONS}
              value={recordingMode}
              onChange={onRecordingModeChange}
              activeClassName={theme.segmentActiveClass}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {isUploadMode
                ? "Envie um arquivo de áudio ou vídeo para processar a reunião."
                : isRemoteRecording
                ? "Compartilhe a aba com áudio e permita o microfone quando solicitado."
                : "Use o microfone deste dispositivo para capturar a conversa."}
            </p>
          </div>

          {isUploadMode && uploadField ? <div>{uploadField}</div> : null}

          <div>
            <label className={labelClassName}>Nome do cliente</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Ex: Tech Solutions Inc."
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isUploadMode ? (
            <div>
              <label className={labelClassName}>Data da reunião</label>
              <DatePicker
                value={selectedMeetingDate}
                onChange={handleDateChange}
                placeholder="Selecione a data da reunião"
                maxDate={today}
              />
            </div>
          ) : null}

          {canSendWhatsAppSummary ? (
            <div>
              <label className={labelClassName}>Número WhatsApp para resumo</label>
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
                <div className="relative mt-2">
                  <MessageSquare className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={customWhatsappNumber}
                    onChange={(event) =>
                      setCustomWhatsappNumber(
                        maskBrazilianPhoneInput(event.target.value)
                      )
                    }
                    className="pl-9"
                  />
                </div>
              ) : null}

              <p className="mt-1.5 text-[11px] text-muted-foreground">
                O número padrão da sua conta já vem selecionado, mas você pode enviar para outro contato.
              </p>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isStarting}
            className={`h-11 w-full rounded-full transition-colors duration-300 ${theme.buttonClass}`}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isUploadMode
                  ? "Preparando upload..."
                  : isRemoteRecording
                  ? "Preparando captura remota..."
                  : "Conectando microfone..."}
              </>
            ) : (
              <>
                <StartIcon className="h-4 w-4" />
                {isUploadMode
                  ? "Processar reunião"
                  : isRemoteRecording
                    ? "Selecionar aba e iniciar"
                    : "Iniciar gravação"}
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            {isUploadMode
              ? "O processamento leva em média 2 a 5 minutos."
              : "Ao encerrar, você poderá descartar ou gerar o sumário da reunião."}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
