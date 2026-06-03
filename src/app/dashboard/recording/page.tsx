"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import {
  AiInsightTip,
  DropZone,
  ToastProvider,
  UploadProgressCard,
  useToast,
} from "@/components/upload";
import {
  RecordingSetupCard,
  type RecordingMode,
  type RecordingSetupValues,
  useRecordingSession,
} from "@/components/recording";
import { Grainient } from "@/components/ui/grainient";
import { useThemeColors } from "@/lib/theme-context";
import {
  createMeetingGroup,
  type MeetingGroupOption,
} from "@/lib/meeting-groups-client";
import posthog from "posthog-js";
import {
  fetchRecordingDefaults,
  fetchRecordingQuotaGate,
} from "./recording-api";
import { submitUploadedMeeting } from "./recording-upload-api";

const UPLOAD_LEAVE_WARNING_MESSAGE =
  "Você perderá o arquivo selecionado se sair agora.";

function getInitialRecordingMode(mode: string | null): RecordingMode {
  if (mode === "remote") return "remote";
  if (mode === "upload") return "upload";
  return "in-person";
}

type RecordingPageState = {
  accountWhatsappNumber: string;
  canSendWhatsAppSummary: boolean;
  canProcessMeetings: boolean;
  meetingQuotaMessage: string;
  meetingGroups: MeetingGroupOption[];
  selectedGroupId: string | null;
  isUploadSubmitting: boolean;
  recordingMode: RecordingMode;
  uploadFile: File | null;
  uploadPreviewProgress: number;
  uploadTimeRemaining: string;
  uploadProgress: number;
  pendingNavigationHref: string | null;
};

type RecordingPageAction =
  | {
      type: "defaultsLoaded";
      accountWhatsappNumber: string;
      canSendWhatsAppSummary: boolean;
      canProcessMeetings: boolean;
      meetingQuotaMessage: string;
      meetingGroups: MeetingGroupOption[];
    }
  | {
      type: "quotaGateLoaded";
      canProcessMeetings: boolean;
      meetingQuotaMessage: string;
    }
  | { type: "recordingModeChanged"; value: RecordingMode }
  | { type: "uploadFileSelected"; file: File }
  | { type: "uploadPreviewTick"; progress: number; timeRemaining: string }
  | { type: "uploadReset" }
  | { type: "uploadStarted" }
  | { type: "uploadProgressChanged"; value: number }
  | { type: "uploadFinished" }
  | { type: "pendingNavigationChanged"; value: string | null }
  | { type: "selectedGroupChanged"; value: string | null }
  | { type: "groupCreated"; option: MeetingGroupOption };

function recordingPageReducer(
  state: RecordingPageState,
  action: RecordingPageAction
): RecordingPageState {
  switch (action.type) {
    case "defaultsLoaded":
      return {
        ...state,
        accountWhatsappNumber: action.accountWhatsappNumber,
        canSendWhatsAppSummary: action.canSendWhatsAppSummary,
        canProcessMeetings: action.canProcessMeetings,
        meetingQuotaMessage: action.meetingQuotaMessage,
        meetingGroups: action.meetingGroups,
      };
    case "quotaGateLoaded":
      return {
        ...state,
        canProcessMeetings: action.canProcessMeetings,
        meetingQuotaMessage: action.meetingQuotaMessage,
      };
    case "recordingModeChanged":
      return { ...state, recordingMode: action.value };
    case "uploadFileSelected":
      return { ...state, uploadFile: action.file };
    case "uploadPreviewTick":
      return {
        ...state,
        uploadPreviewProgress: action.progress,
        uploadTimeRemaining: action.timeRemaining,
      };
    case "uploadReset":
      return {
        ...state,
        uploadFile: null,
        uploadPreviewProgress: 0,
        uploadTimeRemaining: "",
        uploadProgress: 0,
      };
    case "uploadStarted":
      return { ...state, isUploadSubmitting: true, uploadProgress: 0 };
    case "uploadProgressChanged":
      return { ...state, uploadProgress: action.value };
    case "uploadFinished":
      return { ...state, isUploadSubmitting: false };
    case "pendingNavigationChanged":
      return { ...state, pendingNavigationHref: action.value };
    case "selectedGroupChanged":
      return { ...state, selectedGroupId: action.value };
    case "groupCreated":
      return { ...state, meetingGroups: [action.option, ...state.meetingGroups] };
  }
}

const GRAINIENT_COLORS = {
  "in-person": { color1: "#6851FF", color2: "#9B87FF", color3: "#1A0F4E" },
  remote: { color1: "#059669", color2: "#34D399", color3: "#022C22" },
  upload: { color1: "#D97706", color2: "#F59E0B", color3: "#78350F" },
} as const;

function RecordingPageHeader({ mode }: { mode: RecordingMode }) {
  const isRemote = mode === "remote";
  const isUpload = mode === "upload";
  const title = isUpload
    ? "Enviar Arquivo de Reunião"
    : isRemote
      ? "Gravar Reunião Remota"
      : "Gravar Reunião Presencial";
  const breadcrumb = isUpload ? "Upload de arquivo" : "Gravação ao vivo";
  const description = isUpload
    ? "Envie o áudio ou vídeo da reunião e deixe que a IA cuide do resto."
    : "Inicie a gravação, confirme ao encerrar e deixe que a IA cuide do resto.";
  const colors = GRAINIENT_COLORS[mode];

  const words = title.split(" ");
  const lastWord = words[words.length - 1];
  const restOfTitle = words.slice(0, -1).join(" ");

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0">
        <Grainient
          color1={colors.color1}
          color2={colors.color2}
          color3={colors.color3}
          timeSpeed={0.95}
          grainAmount={0.06}
          zoom={0.8}
          warpStrength={0.8}
          contrast={1.2}
          saturation={0.9}
        />
      </div>
      <div className="relative z-10 min-h-[160px] px-4 pb-8 pt-7 sm:min-h-[200px] sm:px-6 sm:pb-14 sm:pt-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/60 sm:mb-3 sm:text-[11px]"
        >
          <Link href="/dashboard" className="transition-colors hover:text-white/90">
            Dashboard
          </Link>
          <ChevronRight className="size-3 text-white/40" />
          <span className="text-white/80">{breadcrumb}</span>
        </nav>
        <h1 className="font-display text-[28px] font-extrabold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.3)] sm:text-3xl">
          <span key={mode} className="animate-fade-in inline-block">
            {restOfTitle}
            <br />
            {lastWord}
          </span>
        </h1>
        <p className="mt-1 max-w-lg text-[13px] text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,0.25)] sm:mt-1.5 sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

function UploadLeaveWarningDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const c = useThemeColors();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 px-3 pb-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === overlayRef.current) {
          onCancel();
        }
      }}
      role="presentation"
    >
      <dialog
        open
        aria-labelledby="upload-leave-warning-title"
        aria-describedby="upload-leave-warning-description"
        className="upload-leave-modal-panel relative m-0 w-full overflow-hidden rounded-t-[28px] border-0 p-0 shadow-2xl sm:max-w-md sm:rounded-[22px]"
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          boxShadow: "0 20px 44px rgba(0,0,0,0.22)",
        }}
      >
        <div
          className="mx-auto mb-2 mt-3 h-1 w-10 shrink-0 rounded-full sm:hidden"
          style={{ background: c.border }}
        />

        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-[14px]"
              style={{
                background: "rgba(104,81,255,0.12)",
                color: "#6851FF",
              }}
            >
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="upload-leave-warning-title"
                className="font-display text-[17px] font-semibold leading-tight"
                style={{ color: c.ink }}
              >
                Sair sem processar?
              </h2>
              <p
                id="upload-leave-warning-description"
                className="mt-0.5 text-[13px] leading-relaxed"
                style={{ color: c.ink2 }}
              >
                {UPLOAD_LEAVE_WARNING_MESSAGE}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ background: c.card2, color: c.ink2 }}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-6 sm:px-6">
          <div
            className="rounded-[14px] p-4"
            style={{
              background: c.card2,
              border: `1px solid ${c.border}`,
            }}
          >
            <p className="text-[13px] font-semibold" style={{ color: c.ink }}>
              Arquivo ainda não enviado
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: c.ink2 }}>
              Ao sair desta tela, será necessário selecionar o arquivo novamente
              antes de iniciar o processamento.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{
                background: "#6851FF",
                color: "#FFFFFF",
              }}
            >
              Continuar aqui
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{
                background: "transparent",
                borderColor: "#FF6B6B",
                color: "#FF6B6B",
              }}
            >
              Continuar e sair
            </button>
          </div>
        </div>

        <style>{`
          @keyframes uploadLeaveModalIn {
            from {
              opacity: 0;
              transform: scale(0.98);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes uploadLeaveModalSlideUp {
            from {
              opacity: 0;
              transform: translateY(18px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .upload-leave-modal-panel {
            animation: uploadLeaveModalSlideUp 0.2s ease-out forwards;
          }

          @media (min-width: 640px) {
            .upload-leave-modal-panel {
              animation-name: uploadLeaveModalIn;
            }
          }
        `}</style>
      </dialog>
    </div>
  );
}

type RecordingPageController = {
  handleCancelPendingNavigation: () => void;
  handleConfirmPendingNavigation: () => void;
  handleCreateGroup: (name: string) => Promise<MeetingGroupOption>;
  handleRecordingModeChange: (mode: RecordingMode) => void;
  handleSelectedGroupChange: (value: string | null) => void;
  handleStartRecording: (values: RecordingSetupValues) => Promise<void>;
  meetingGroups: MeetingGroupOption[];
  pendingNavigationHref: string | null;
  recordingMode: RecordingMode;
  recordingUploadField?: React.ReactNode;
  selectedGroupId: string | null;
  setupCapabilities: {
    accountWhatsappNumber: string;
    canProcessMeetings: boolean;
    canSendWhatsAppSummary: boolean;
    meetingQuotaMessage: string;
  };
  setupStatus: {
    hasUploadFile: boolean;
    isStarting: boolean;
  };
  showWarning: (message: string) => void;
};

function useRecordingPageController(): RecordingPageController {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const {
    hasActiveSession,
    isStarting: isRecordingStarting,
    startRecording,
  } = useRecordingSession();

  const [state, dispatch] = useReducer(recordingPageReducer, {
    accountWhatsappNumber: "",
    canSendWhatsAppSummary: false,
    canProcessMeetings: true,
    meetingQuotaMessage: "",
    meetingGroups: [],
    selectedGroupId: null,
    isUploadSubmitting: false,
    recordingMode: getInitialRecordingMode(searchParams.get("mode")),
    uploadFile: null,
    uploadPreviewProgress: 0,
    uploadTimeRemaining: "",
    uploadProgress: 0,
    pendingNavigationHref: null,
  });
  const {
    accountWhatsappNumber,
    canSendWhatsAppSummary,
    canProcessMeetings,
    meetingQuotaMessage,
    meetingGroups,
    selectedGroupId,
    isUploadSubmitting,
    recordingMode,
    uploadFile,
    uploadPreviewProgress,
    uploadTimeRemaining,
    pendingNavigationHref,
  } = state;

  const uploadTimerRef = useRef<number | null>(null);
  const uploadStartTimeRef = useRef<number>(0);
  const uploadPreviewProgressRef = useRef(0);
  const pageClickCaptureHandlerRef = useRef<(event: MouseEvent) => void>(
    () => {}
  );

  const clearUploadPreviewTimer = useCallback(() => {
    if (uploadTimerRef.current) {
      window.clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
  }, []);

  const resetUploadState = useCallback(() => {
    clearUploadPreviewTimer();
    uploadPreviewProgressRef.current = 0;
    dispatch({ type: "uploadReset" });
  }, [clearUploadPreviewTimer]);

  const isStarting = isUploadSubmitting || isRecordingStarting;
  const isQuotaBlocked = !canProcessMeetings;
  const hasSelectedUploadFile =
    recordingMode === "upload" && Boolean(uploadFile) && !isUploadSubmitting;

  const updateModeUrl = useCallback(
    (mode: RecordingMode) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (mode === "in-person") {
        nextParams.delete("mode");
      } else {
        nextParams.set("mode", mode);
      }

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDefaults() {
      try {
        const defaults = await fetchRecordingDefaults();
        if (!cancelled) {
          dispatch({
            type: "defaultsLoaded",
            accountWhatsappNumber: defaults.accountWhatsappNumber,
            canSendWhatsAppSummary: defaults.canSendWhatsAppSummary,
            canProcessMeetings: defaults.canProcessMeetings,
            meetingQuotaMessage: defaults.meetingQuotaMessage,
            meetingGroups: defaults.meetingGroups,
          });
        }
      } catch (error) {
        if (!cancelled) {
          show(
            error instanceof Error
              ? error.message
              : "Erro ao carregar os dados da gravação.",
            "warning"
          );
        }
      }
    }

    void loadDefaults();

    return () => {
      cancelled = true;
      clearUploadPreviewTimer();
    };
  }, [clearUploadPreviewTimer, show]);

  useEffect(() => {
    dispatch({
      type: "recordingModeChanged",
      value: getInitialRecordingMode(searchParams.get("mode")),
    });
  }, [searchParams]);

  useEffect(() => {
    if (!hasSelectedUploadFile) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = UPLOAD_LEAVE_WARNING_MESSAGE;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasSelectedUploadFile]);

  const startUploadPreviewProgress = useCallback(() => {
    clearUploadPreviewTimer();
    uploadStartTimeRef.current = Date.now();
    uploadPreviewProgressRef.current = 0;
    dispatch({ type: "uploadPreviewTick", progress: 0, timeRemaining: "" });

    uploadTimerRef.current = window.setInterval(() => {
      const next = Math.min(uploadPreviewProgressRef.current + Math.random() * 8 + 6, 100);
      uploadPreviewProgressRef.current = next;
      const elapsed = (Date.now() - uploadStartTimeRef.current) / 1000;
      const rate = next / elapsed;
      const remaining = rate > 0 ? Math.round((100 - next) / rate) : 0;
      dispatch({
        type: "uploadPreviewTick",
        progress: next,
        timeRemaining: next >= 100 ? "" : `${remaining}s restantes`,
      });

      if (next >= 100) {
        clearUploadPreviewTimer();
      }
    }, 200);
  }, [clearUploadPreviewTimer]);

  const handleFile = useCallback(
    (file: File) => {
      dispatch({ type: "uploadFileSelected", file });
      startUploadPreviewProgress();
    },
    [startUploadPreviewProgress]
  );

  const handlePageClickCapture = useCallback(
    (event: MouseEvent) => {
      if (!hasSelectedUploadFile || event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: "pendingNavigationChanged", value: nextUrl.href });
    },
    [hasSelectedUploadFile]
  );

  useEffect(() => {
    pageClickCaptureHandlerRef.current = handlePageClickCapture;
  }, [handlePageClickCapture]);

  useEffect(() => {
    if (!hasSelectedUploadFile) return;

    function handleDocumentClick(event: MouseEvent) {
      pageClickCaptureHandlerRef.current(event);
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasSelectedUploadFile]);

  const handleCancelPendingNavigation = useCallback(() => {
    dispatch({ type: "pendingNavigationChanged", value: null });
  }, []);

  const handleConfirmPendingNavigation = useCallback(() => {
    if (!pendingNavigationHref) return;

    const nextHref = pendingNavigationHref;
    dispatch({ type: "pendingNavigationChanged", value: null });
    resetUploadState();

    const nextUrl = new URL(nextHref, window.location.href);
    if (nextUrl.origin === window.location.origin) {
      router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      return;
    }

    window.location.assign(nextUrl.href);
  }, [pendingNavigationHref, resetUploadState, router]);

  const ensureCanProcessMeetings = useCallback(async () => {
    try {
      const quotaGate = await fetchRecordingQuotaGate();
      dispatch({
        type: "quotaGateLoaded",
        canProcessMeetings: quotaGate.canProcessMeetings,
        meetingQuotaMessage: quotaGate.meetingQuotaMessage,
      });

      if (!quotaGate.canProcessMeetings) {
        show(quotaGate.meetingQuotaMessage, "warning");
        return false;
      }

      return true;
    } catch {
      const message =
        "Não foi possível validar sua quota agora. Tente novamente em instantes.";
      dispatch({
        type: "quotaGateLoaded",
        canProcessMeetings: false,
        meetingQuotaMessage: message,
      });
      show(message, "warning");
      return false;
    }
  }, [show]);

  const handleStartRecording = useCallback(
    async (values: RecordingSetupValues) => {
      if (!(await ensureCanProcessMeetings())) {
        return;
      }

      if (values.recordingMode === "upload") {
        if (!uploadFile || !values.meetingDate) {
          return;
        }

        dispatch({ type: "uploadStarted" });

        try {
          const meetingId = await submitUploadedMeeting({
            meetingDate: values.meetingDate,
            whatsappNumber: values.whatsappNumber,
            file: uploadFile,
            groupId: values.groupId,
            onUploadProgress: (value) =>
              dispatch({ type: "uploadProgressChanged", value }),
          });

          posthog.capture("meeting_upload_submitted", {
            file_type: uploadFile.type,
            file_size_mb: Math.round(uploadFile.size / (1024 * 1024) * 10) / 10,
            has_group: Boolean(values.groupId),
            has_whatsapp: Boolean(values.whatsappNumber),
          });
          router.push(`/dashboard/processing?id=${meetingId}`);
        } catch (error) {
          show(
            error instanceof Error ? error.message : "Erro ao processar upload.",
            "error"
          );
        } finally {
          dispatch({ type: "uploadFinished" });
        }

        return;
      }

      try {
        await startRecording(values);
        posthog.capture("meeting_recording_started", {
          recording_mode: values.recordingMode,
          has_group: Boolean(values.groupId),
          has_whatsapp: Boolean(values.whatsappNumber),
        });
      } catch (error) {
        posthog.captureException(error instanceof Error ? error : new Error(String(error)));
        show(
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar a gravação.",
          "error"
        );
      }
    },
    [ensureCanProcessMeetings, router, show, startRecording, uploadFile]
  );

  const handleRecordingModeChange = useCallback(
    (mode: RecordingMode) => {
      if (hasActiveSession || isStarting) {
        show(
          "Finalize ou descarte a gravação atual antes de trocar de modo.",
          "warning"
        );
        return;
      }

      dispatch({ type: "recordingModeChanged", value: mode });
      if (mode !== "upload") {
        resetUploadState();
      }
      updateModeUrl(mode);
    },
    [hasActiveSession, isStarting, resetUploadState, show, updateModeUrl]
  );

  const handleCreateGroup = useCallback(
    async (name: string) => {
      const group = await createMeetingGroup(name);
      const option = { id: group.id, name: group.name };
      dispatch({ type: "groupCreated", option });
      return option;
    },
    []
  );

  const handleSelectedGroupChange = useCallback((value: string | null) => {
    dispatch({ type: "selectedGroupChanged", value });
  }, []);

  const recordingUploadField = useMemo(() => {
    if (recordingMode !== "upload") return undefined;

    if (uploadFile) {
      return (
        <UploadProgressCard
          file={uploadFile}
          progress={uploadPreviewProgress}
          timeRemaining={uploadTimeRemaining}
          onRemove={resetUploadState}
        />
      );
    }

    return (
      <DropZone
        onFile={handleFile}
        onError={(message) => show(message, "error")}
        disabled={isQuotaBlocked}
        compact
      />
    );
  }, [
    handleFile,
    isQuotaBlocked,
    recordingMode,
    resetUploadState,
    show,
    uploadFile,
    uploadPreviewProgress,
    uploadTimeRemaining,
  ]);

  const setupCapabilities = useMemo(
    () => ({
      accountWhatsappNumber,
      canProcessMeetings,
      canSendWhatsAppSummary,
      meetingQuotaMessage,
    }),
    [
      accountWhatsappNumber,
      canProcessMeetings,
      canSendWhatsAppSummary,
      meetingQuotaMessage,
    ]
  );

  const setupStatus = useMemo(
    () => ({ hasUploadFile: Boolean(uploadFile), isStarting }),
    [isStarting, uploadFile]
  );

  const showWarning = useCallback(
    (message: string) => show(message, "warning"),
    [show]
  );

  return {
    handleCancelPendingNavigation,
    handleConfirmPendingNavigation,
    handleCreateGroup,
    handleRecordingModeChange,
    handleSelectedGroupChange,
    handleStartRecording,
    meetingGroups,
    pendingNavigationHref,
    recordingMode,
    recordingUploadField,
    selectedGroupId,
    setupCapabilities,
    setupStatus,
    showWarning,
  };
}

function RecordingPageContent({ page }: { page: RecordingPageController }) {
  return (
    <>
      <div className="animate-fade-in min-h-full">
        <RecordingPageHeader mode={page.recordingMode} />

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <RecordingSetupCard
              capabilities={page.setupCapabilities}
              status={page.setupStatus}
              recordingMode={page.recordingMode}
              meetingGroups={page.meetingGroups}
              selectedGroupId={page.selectedGroupId}
              onRecordingModeChange={page.handleRecordingModeChange}
              onGroupIdChange={page.handleSelectedGroupChange}
              onCreateGroup={page.handleCreateGroup}
              onStart={page.handleStartRecording}
              onValidationError={page.showWarning}
              uploadField={page.recordingUploadField}
            />
          </div>

          <div className="w-full shrink-0 lg:w-[340px]">
            <AiInsightTip />
          </div>
        </div>
      </div>

      <UploadLeaveWarningDialog
        open={Boolean(page.pendingNavigationHref)}
        onCancel={page.handleCancelPendingNavigation}
        onConfirm={page.handleConfirmPendingNavigation}
      />
    </>
  );
}

function RecordingPageInner() {
  const page = useRecordingPageController();
  return <RecordingPageContent page={page} />;
}

export default function RecordingPage() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <RecordingPageInner />
      </Suspense>
    </ToastProvider>
  );
}
