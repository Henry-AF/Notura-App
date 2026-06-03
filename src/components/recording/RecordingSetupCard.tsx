"use client";

import React, { useMemo, useReducer } from "react";
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  Mic,
  MonitorUp,
  FolderPlus,
  UploadCloud,
  type LucideIcon,
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

interface RecordingSetupCapabilities {
  accountWhatsappNumber?: string;
  canSendWhatsAppSummary?: boolean;
  canProcessMeetings?: boolean;
  meetingQuotaMessage?: string;
}

interface RecordingSetupStatus {
  isStarting: boolean;
  hasUploadFile?: boolean;
}

interface RecordingSetupCardProps {
  capabilities?: RecordingSetupCapabilities;
  status: RecordingSetupStatus;
  recordingMode: RecordingMode;
  meetingGroups?: MeetingGroupOption[];
  selectedGroupId?: string | null;
  onRecordingModeChange: (mode: RecordingMode) => void;
  onGroupIdChange?: (groupId: string | null) => void;
  onCreateGroup?: (name: string) => Promise<MeetingGroupOption>;
  onStart: (values: RecordingSetupValues) => void | Promise<void>;
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
const EMPTY_MEETING_GROUPS: MeetingGroupOption[] = [];

type RecordingSetupController = {
  accountWhatsappDisplay: string;
  canProcessMeetings: boolean;
  canSendWhatsAppSummary: boolean;
  customWhatsappNumber: string;
  effectiveWhatsappSource: WhatsappNumberSource;
  handleCreateGroup: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleCustomWhatsappChange: (value: string) => void;
  handleDateChange: (date: Date | undefined) => void;
  handleGroupValueChange: (value: string) => void;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  handleWhatsappSourceChange: (value: string) => void;
  hasAccountWhatsappNumber: boolean;
  isCreateGroupOpen: boolean;
  isCreatingGroup: boolean;
  isRemoteRecording: boolean;
  isStartDisabled: boolean;
  isStarting: boolean;
  isUploadMode: boolean;
  meetingGroups: MeetingGroupOption[];
  newGroupName: string;
  onRecordingModeChange: (mode: RecordingMode) => void;
  quotaMessage: string;
  recordingMode: RecordingMode;
  selectedGroupId: string | null;
  selectedMeetingDate: Date | undefined;
  setCreateGroupOpen: (value: boolean) => void;
  setNewGroupName: (value: string) => void;
  startIcon: LucideIcon;
  theme: ReturnType<typeof getRecordingTheme>;
  today: Date;
  uploadField?: React.ReactNode;
};

function useRecordingSetupController({
  capabilities,
  status,
  recordingMode,
  meetingGroups = EMPTY_MEETING_GROUPS,
  selectedGroupId = null,
  onRecordingModeChange,
  onGroupIdChange,
  onCreateGroup,
  onStart,
  onValidationError,
  uploadField,
}: RecordingSetupCardProps): RecordingSetupController {
  const {
    accountWhatsappNumber = "",
    canSendWhatsAppSummary = true,
    canProcessMeetings = true,
    meetingQuotaMessage = "",
  } = capabilities ?? {};
  const { isStarting, hasUploadFile = false } = status;
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

  const effectiveWhatsappSource =
    hasAccountWhatsappNumber && !hasTouchedWhatsappSource
      ? "account"
      : hasAccountWhatsappNumber
        ? whatsappSource
        : "custom";

  const selectedWhatsappRaw =
    effectiveWhatsappSource === "account"
      ? accountWhatsappNumberNormalized
      : customWhatsappNumber;

  function handleDateChange(date: Date | undefined) {
    dispatch({ type: "dateChanged", date });
  }

  function handleWhatsappSourceChange(value: string) {
    dispatch({
      type: "whatsappSourceChanged",
      value: value as WhatsappNumberSource,
    });
  }

  function handleCustomWhatsappChange(value: string) {
    dispatch({ type: "customWhatsappChanged", value });
  }

  function handleGroupValueChange(value: string) {
    if (value === CREATE_GROUP_VALUE) {
      dispatch({ type: "createGroupOpenChanged", value: true });
      return;
    }

    onGroupIdChange?.(value === NO_GROUP_VALUE ? null : value);
  }

  function setCreateGroupOpen(value: boolean) {
    dispatch({ type: "createGroupOpenChanged", value });
  }

  function setNewGroupName(value: string) {
    dispatch({ type: "newGroupNameChanged", value });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canProcessMeetings) {
      onValidationError(quotaMessage);
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

    void onStart({
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
  const quotaMessage =
    meetingQuotaMessage ||
    "Você não tem quota disponível para processar novas reuniões.";
  const isStartDisabled = isStarting || !canProcessMeetings;
  const StartIcon = isRemoteRecording
    ? MonitorUp
    : isUploadMode
      ? UploadCloud
      : Mic;
  const theme = getRecordingTheme(recordingMode);

  return {
    accountWhatsappDisplay,
    canProcessMeetings,
    canSendWhatsAppSummary,
    customWhatsappNumber,
    effectiveWhatsappSource,
    handleCreateGroup,
    handleCustomWhatsappChange,
    handleDateChange,
    handleGroupValueChange,
    handleSubmit,
    handleWhatsappSourceChange,
    hasAccountWhatsappNumber,
    isCreateGroupOpen,
    isCreatingGroup,
    isRemoteRecording,
    isStartDisabled,
    isStarting,
    isUploadMode,
    meetingGroups,
    newGroupName,
    onRecordingModeChange,
    quotaMessage,
    recordingMode,
    selectedGroupId,
    selectedMeetingDate,
    setCreateGroupOpen,
    setNewGroupName,
    startIcon: StartIcon,
    theme,
    today,
    uploadField,
  };
}

function RecordingSetupHeader({
  isUploadMode,
  canSendWhatsAppSummary,
}: {
  isUploadMode: boolean;
  canSendWhatsAppSummary: boolean;
}) {
  return (
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
  );
}

function RecordingModeField({
  recordingMode,
  theme,
  onRecordingModeChange,
}: {
  recordingMode: RecordingMode;
  theme: ReturnType<typeof getRecordingTheme>;
  onRecordingModeChange: (mode: RecordingMode) => void;
}) {
  const isRemoteRecording = recordingMode === "remote";
  const isUploadMode = recordingMode === "upload";

  return (
    <div>
      <span className={labelClassName}>Modo da reunião</span>
      <SegmentedControl
        options={RECORDING_MODE_OPTIONS}
        value={recordingMode}
        onChange={onRecordingModeChange}
        ariaLabel="Modo da reunião"
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
  );
}

function QuotaNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p className="text-xs leading-relaxed">{message}</p>
    </div>
  );
}

function MeetingGroupField({
  meetingGroups,
  selectedGroupId,
  onValueChange,
}: {
  meetingGroups: MeetingGroupOption[];
  selectedGroupId: string | null;
  onValueChange: (value: string) => void;
}) {
  return (
    <div>
      <span className={labelClassName}>Grupo</span>
      <Select value={selectedGroupId ?? NO_GROUP_VALUE} onValueChange={onValueChange}>
        <SelectTrigger
          aria-label="Grupo"
          className="h-10 rounded-lg border-input bg-background text-foreground"
        >
          <SelectValue placeholder="Sem grupo" />
        </SelectTrigger>
        <SelectContent className="animate-none">
          <SelectItem value={NO_GROUP_VALUE}>Sem grupo</SelectItem>
          {meetingGroups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.name}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_GROUP_VALUE}>Criar novo grupo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function MeetingDateField({
  selectedMeetingDate,
  today,
  onDateChange,
}: {
  selectedMeetingDate: Date | undefined;
  today: Date;
  onDateChange: (date: Date | undefined) => void;
}) {
  return (
    <div>
      <span className={labelClassName}>Data da reunião</span>
      <DatePicker
        value={selectedMeetingDate}
        onChange={onDateChange}
        placeholder="Selecione a data da reunião"
        ariaLabel="Data da reunião"
        maxDate={today}
      />
    </div>
  );
}

function WhatsappRecipientField({
  accountWhatsappDisplay,
  customWhatsappNumber,
  effectiveWhatsappSource,
  hasAccountWhatsappNumber,
  onCustomWhatsappChange,
  onWhatsappSourceChange,
}: {
  accountWhatsappDisplay: string;
  customWhatsappNumber: string;
  effectiveWhatsappSource: WhatsappNumberSource;
  hasAccountWhatsappNumber: boolean;
  onCustomWhatsappChange: (value: string) => void;
  onWhatsappSourceChange: (value: string) => void;
}) {
  return (
    <div>
      <span className={labelClassName}>Número WhatsApp para resumo</span>
      <Select value={effectiveWhatsappSource} onValueChange={onWhatsappSourceChange}>
        <SelectTrigger
          aria-label="Número WhatsApp para resumo"
          className="h-10 rounded-lg border-input bg-background text-foreground"
        >
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

      {effectiveWhatsappSource === "custom" ? (
        <div className="relative mt-2">
          <MessageSquare className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            aria-label="Número personalizado para resumo"
            placeholder="(00) 00000-0000"
            value={customWhatsappNumber}
            onChange={(event) => onCustomWhatsappChange(event.target.value)}
            className="pl-9"
          />
        </div>
      ) : null}

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        O número padrão da sua conta já vem selecionado, mas você pode enviar para outro contato.
      </p>
    </div>
  );
}

function StartRecordingButton({
  button,
  theme,
}: {
  button: {
    canProcessMeetings: boolean;
    isRemoteRecording: boolean;
    isStarting: boolean;
    isStartDisabled: boolean;
    isUploadMode: boolean;
    startIcon: LucideIcon;
  };
  theme: ReturnType<typeof getRecordingTheme>;
}) {
  const StartIcon = button.startIcon;

  return (
    <Button
      type="submit"
      disabled={button.isStartDisabled}
      className={`h-11 w-full rounded-full transition-colors duration-300 ${theme.buttonClass}`}
    >
      {button.isStarting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {button.isUploadMode
            ? "Preparando upload..."
            : button.isRemoteRecording
              ? "Preparando captura remota..."
              : "Conectando microfone..."}
        </>
      ) : (
        <>
          <StartIcon className="size-4" />
          {!button.canProcessMeetings
            ? "Limite atingido"
            : button.isUploadMode
              ? "Processar reunião"
              : button.isRemoteRecording
                ? "Selecionar aba e iniciar"
                : "Iniciar gravação"}
        </>
      )}
    </Button>
  );
}

function CreateGroupDialog({
  dialog,
  onCreateGroup,
}: {
  dialog: {
    isCreatingGroup: boolean;
    isOpen: boolean;
    newGroupName: string;
    setNewGroupName: (value: string) => void;
    setOpen: (value: boolean) => void;
  };
  onCreateGroup: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Dialog open={dialog.isOpen} onOpenChange={dialog.setOpen}>
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
        <form
          onSubmit={(event) => {
            void onCreateGroup(event);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="recording-new-group-name" className={labelClassName}>
              Nome do grupo
            </label>
            <Input
              id="recording-new-group-name"
              autoFocus
              maxLength={80}
              value={dialog.newGroupName}
              onChange={(event) => dialog.setNewGroupName(event.target.value)}
              placeholder="Ex: Cliente Acme"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => dialog.setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={dialog.isCreatingGroup}>
              {dialog.isCreatingGroup ? (
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
  );
}

export function RecordingSetupCard(props: RecordingSetupCardProps) {
  const card = useRecordingSetupController(props);

  return (
    <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
      <RecordingSetupHeader
        isUploadMode={card.isUploadMode}
        canSendWhatsAppSummary={card.canSendWhatsAppSummary}
      />

      <CardContent className="pt-0">
        <form onSubmit={card.handleSubmit} className="space-y-4" noValidate>
          <RecordingModeField
            recordingMode={card.recordingMode}
            theme={card.theme}
            onRecordingModeChange={card.onRecordingModeChange}
          />

          {card.isUploadMode && card.uploadField ? (
            <div>{card.uploadField}</div>
          ) : null}

          {!card.canProcessMeetings ? (
            <QuotaNotice message={card.quotaMessage} />
          ) : null}

          <MeetingGroupField
            meetingGroups={card.meetingGroups}
            selectedGroupId={card.selectedGroupId}
            onValueChange={card.handleGroupValueChange}
          />

          {card.isUploadMode ? (
            <MeetingDateField
              selectedMeetingDate={card.selectedMeetingDate}
              today={card.today}
              onDateChange={card.handleDateChange}
            />
          ) : null}

          {card.canSendWhatsAppSummary ? (
            <WhatsappRecipientField
              accountWhatsappDisplay={card.accountWhatsappDisplay}
              customWhatsappNumber={card.customWhatsappNumber}
              effectiveWhatsappSource={card.effectiveWhatsappSource}
              hasAccountWhatsappNumber={card.hasAccountWhatsappNumber}
              onCustomWhatsappChange={card.handleCustomWhatsappChange}
              onWhatsappSourceChange={card.handleWhatsappSourceChange}
            />
          ) : null}

          <StartRecordingButton
            button={{
              canProcessMeetings: card.canProcessMeetings,
              isRemoteRecording: card.isRemoteRecording,
              isStarting: card.isStarting,
              isStartDisabled: card.isStartDisabled,
              isUploadMode: card.isUploadMode,
              startIcon: card.startIcon,
            }}
            theme={card.theme}
          />

          <p className="text-center text-[11px] text-muted-foreground">
            {card.isUploadMode
              ? "O processamento leva em média 2 a 5 minutos."
              : "Ao encerrar, você poderá descartar ou gerar o sumário da reunião."}
          </p>
        </form>
      </CardContent>

      <CreateGroupDialog
        dialog={{
          isCreatingGroup: card.isCreatingGroup,
          isOpen: card.isCreateGroupOpen,
          newGroupName: card.newGroupName,
          setNewGroupName: card.setNewGroupName,
          setOpen: card.setCreateGroupOpen,
        }}
        onCreateGroup={card.handleCreateGroup}
      />
    </Card>
  );
}
