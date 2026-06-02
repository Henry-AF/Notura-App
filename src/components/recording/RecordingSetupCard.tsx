"use client";

import React, { useEffect, useMemo, useReducer } from "react";
import {
  Loader2,
  MessageSquare,
  Mic,
  MonitorUp,
  FolderPlus,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SegmentedControlOption } from "@/components/ui/segmented-control";
import type { MeetingGroupOption } from "@/lib/meeting-groups-client";
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

type RecordingSetupState = {
  meetingDate: string;
  selectedMeetingDate: Date | undefined;
  whatsappSource: WhatsappNumberSource;
  customWhatsappNumber: string;
  hasTouchedWhatsappSource: boolean;
  isCreateGroupOpen: boolean;
  newGroupName: string;
  isCreatingGroup: boolean;
};

type RecordingSetupAction =
  | { type: "dateChanged"; date: Date | undefined }
  | { type: "whatsappSourceChanged"; value: WhatsappNumberSource }
  | { type: "customWhatsappChanged"; value: string }
  | { type: "accountSourceSelected" }
  | { type: "customSourceSelected" }
  | { type: "createGroupOpenChanged"; value: boolean }
  | { type: "newGroupNameChanged"; value: string }
  | { type: "createGroupStarted" }
  | { type: "createGroupFinished" }
  | { type: "groupCreated" };

const initialRecordingSetupState: RecordingSetupState = {
  meetingDate: "",
  selectedMeetingDate: undefined,
  whatsappSource: "account",
  customWhatsappNumber: "",
  hasTouchedWhatsappSource: false,
  isCreateGroupOpen: false,
  newGroupName: "",
  isCreatingGroup: false,
};

function formatDateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordingSetupReducer(
  state: RecordingSetupState,
  action: RecordingSetupAction
): RecordingSetupState {
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
    case "createGroupOpenChanged":
      return { ...state, isCreateGroupOpen: action.value };
    case "newGroupNameChanged":
      return { ...state, newGroupName: action.value };
    case "createGroupStarted":
      return { ...state, isCreatingGroup: true };
    case "createGroupFinished":
      return { ...state, isCreatingGroup: false };
    case "groupCreated":
      return { ...state, newGroupName: "", isCreateGroupOpen: false };
  }
}

export interface RecordingSetupValues {
  whatsappNumber: string;
  recordingMode: RecordingMode;
  groupId?: string | null;
  meetingDate?: string;
}

interface RecordingSetupCardProps {
  accountWhatsappNumber?: string;
  canSendWhatsAppSummary?: boolean;
  isStarting: boolean;
  hasUploadFile?: boolean;
  recordingMode: RecordingMode;
  meetingGroups?: MeetingGroupOption[];
  selectedGroupId?: string | null;
  onRecordingModeChange: (mode: RecordingMode) => void;
  onGroupIdChange?: (groupId: string | null) => void;
  onCreateGroup?: (name: string) => Promise<MeetingGroupOption>;
  onStart: (values: RecordingSetupValues) => void;
  onValidationError: (message: string) => void;
  uploadField?: React.ReactNode;
}

const RECORDING_MODE_OPTIONS: SegmentedControlOption<RecordingMode>[] = [
  { value: "in-person", label: "Presencial", icon: <Mic className="size-3.5" /> },
  { value: "remote", label: "Remota", icon: <MonitorUp className="size-3.5" /> },
  { value: "upload", label: "Upload", icon: <UploadCloud className="size-3.5" /> },
];

const labelClassName =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";
const NO_GROUP_VALUE = "__none__";
const CREATE_GROUP_VALUE = "__create__";

export function RecordingSetupCard({
  accountWhatsappNumber = "",
  canSendWhatsAppSummary = true,
  isStarting,
  hasUploadFile = false,
  recordingMode,
  meetingGroups = [],
  selectedGroupId = null,
  onRecordingModeChange,
  onGroupIdChange,
  onCreateGroup,
  onStart,
  onValidationError,
  uploadField,
}: RecordingSetupCardProps) {
  const [state, dispatch] = useReducer(
    recordingSetupReducer,
    initialRecordingSetupState
  );
  const {
    meetingDate,
    selectedMeetingDate,
    whatsappSource,
    customWhatsappNumber,
    hasTouchedWhatsappSource,
    isCreateGroupOpen,
    newGroupName,
    isCreatingGroup,
  } = state;
  const today = useMemo(() => new Date(), []);

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

  const selectedWhatsappRaw =
    whatsappSource === "account"
      ? accountWhatsappNumberNormalized
      : customWhatsappNumber;

  function handleDateChange(date: Date | undefined) {
    dispatch({ type: "dateChanged", date });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      whatsappNumber: canSendWhatsAppSummary
        ? normalizeWhatsappNumber(selectedWhatsappRaw)
        : "",
      recordingMode,
      groupId: selectedGroupId,
      meetingDate: isUploadMode ? meetingDate : undefined,
    });
  }

  async function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onCreateGroup) return;

    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      onValidationError("Preencha o nome do grupo.");
      return;
    }

    dispatch({ type: "createGroupStarted" });
    try {
      const group = await onCreateGroup(trimmedName);
      onGroupIdChange?.(group.id);
      dispatch({ type: "groupCreated" });
    } catch (error) {
      onValidationError(
        error instanceof Error ? error.message : "Erro ao criar grupo."
      );
    } finally {
      dispatch({ type: "createGroupFinished" });
    }
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
            <label className={labelClassName}>Grupo</label>
            <Select
              value={selectedGroupId ?? NO_GROUP_VALUE}
              onValueChange={(value) => {
                if (value === CREATE_GROUP_VALUE) {
                  dispatch({ type: "createGroupOpenChanged", value: true });
                  return;
                }

                onGroupIdChange?.(value === NO_GROUP_VALUE ? null : value);
              }}
            >
              <SelectTrigger className="h-10 rounded-lg border-input bg-background text-foreground">
                <SelectValue placeholder="Sem grupo" />
              </SelectTrigger>
              <SelectContent className="animate-none">
                <SelectItem value={NO_GROUP_VALUE}>Sem grupo</SelectItem>
                {meetingGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
                <SelectItem value={CREATE_GROUP_VALUE}>
                  Criar novo grupo
                </SelectItem>
              </SelectContent>
            </Select>
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
                <div className="relative mt-2">
                  <MessageSquare className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={customWhatsappNumber}
                    onChange={(event) =>
                      dispatch({
                        type: "customWhatsappChanged",
                        value: event.target.value,
                      })
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
                <Loader2 className="size-4 animate-spin" />
                {isUploadMode
                  ? "Preparando upload..."
                  : isRemoteRecording
                  ? "Preparando captura remota..."
                  : "Conectando microfone..."}
              </>
            ) : (
              <>
                <StartIcon className="size-4" />
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

      <Dialog
        open={isCreateGroupOpen}
        onOpenChange={(value) =>
          dispatch({ type: "createGroupOpenChanged", value })
        }
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderPlus className="size-5" />
            </div>
            <DialogTitle>Criar grupo</DialogTitle>
            <DialogDescription>
              O grupo sera selecionado para esta reuniao assim que for criado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className={labelClassName}>Nome do grupo</label>
              <Input
                autoFocus
                maxLength={80}
                value={newGroupName}
                onChange={(event) =>
                  dispatch({
                    type: "newGroupNameChanged",
                    value: event.target.value,
                  })
                }
                placeholder="Ex: Cliente Acme"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  dispatch({ type: "createGroupOpenChanged", value: false })
                }
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingGroup}>
                {isCreatingGroup ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FolderPlus className="size-4" />
                )}
                Criar grupo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
