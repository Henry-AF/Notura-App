import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  activateRecordingAudioMode,
  deactivateRecordingAudioMode,
  deleteRecordingFile,
  getRecordingFileInfo,
  getRecordingOptions,
  type RecordingFileInfo,
} from '@/lib/audio/recorder';
import {
  checkMicrophonePermission,
  openMicrophoneSettings,
  requestMicrophonePermission,
} from '@/lib/audio/permissions';
import {
  clearPendingRecording,
  loadPendingRecording,
  savePendingRecording,
  type PendingRecording,
} from '@/lib/meetings/recording-recovery';
import {
  PROCESSING_STEP_IDS,
  POST_PROCESSING_ROUTE,
  fetchAccountWhatsappDefaults,
  getTodayDateStringUtc,
  pollUntilTerminal,
  resolveWhatsappGate,
  submitMeetingRecording,
  type WhatsappGate,
} from './record-api';
import { useTheme } from '@/theme';
import { ThemedText } from '@/components/ui/ThemedText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type Phase =
  | 'idle'
  | 'permission-denied'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'uploading'
  | 'processing'
  | 'done'
  | 'failed';

const STEP_LABELS: Record<(typeof PROCESSING_STEP_IDS)[number], string> = {
  'update-status-processing': 'Preparando job',
  transcribe: 'Transcrevendo áudio',
  'index-transcript-chunks': 'Indexando transcrição',
  'summarize-meeting': 'Analisando com IA',
  'save-results': 'Salvando resultados',
  'send-whatsapp': 'Enviando no WhatsApp',
  cleanup: 'Finalizando',
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RecordScreen() {
  const router = useRouter();
  const netInfo = useNetInfo();
  const { colors, spacing } = useTheme();

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [whatsappGate, setWhatsappGate] = useState<WhatsappGate | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecording | null>(null);

  const recorder = useAudioRecorder(getRecordingOptions(), (status) => {
    if (status.hasError) {
      setErrorMessage(status.error ?? 'A gravação foi interrompida.');
    }
  });
  const recorderState = useAudioRecorderState(recorder, 500);

  const fileInfoRef = useRef<RecordingFileInfo | null>(null);
  const meetingDateRef = useRef<string | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);

  useLoadInitialState({ setWhatsappGate, setPendingRecovery });
  useInterruptionReconciliation({ phase, isRecording: recorderState.isRecording, setPhase, setErrorMessage });
  useNetworkRetry({ phase, isConnected: netInfo.isConnected, onRetry: () => void handleUploadAndProcess() });
  usePollingCleanup(stopPollingRef);

  const startProcessingPoll = useCallback(
    (meetingId: string) => {
      setPhase('processing');
      setStepIndex(0);
      stopPollingRef.current = pollUntilTerminal(meetingId, (tick) => {
        setStepIndex(tick.stepIndex);
        if (tick.status === 'completed') {
          setPhase('done');
          if (fileInfoRef.current) deleteRecordingFile(fileInfoRef.current.uri);
          setTimeout(() => router.replace(POST_PROCESSING_ROUTE), 1500);
        } else if (tick.status === 'failed') {
          setPhase('failed');
          setErrorMessage(tick.errorMessage ?? 'Erro no processamento da reunião.');
        }
      });
    },
    [router]
  );

  const handleUploadAndProcess = useCallback(async () => {
    const fileInfo = fileInfoRef.current;
    const meetingDate = meetingDateRef.current;
    if (!fileInfo || !meetingDate) return;

    setPhase('uploading');
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      const meetingId = await submitMeetingRecording({
        fileInfo,
        meetingDate,
        whatsappNumber: whatsappGate?.whatsappNumber || undefined,
        onUploadProgress: setUploadProgress,
      });

      await clearPendingRecording();
      startProcessingPoll(meetingId);
    } catch (error) {
      setPhase('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao enviar a gravação.');
    }
  }, [whatsappGate, startProcessingPoll]);

  async function handleStartRecording() {
    setErrorMessage(null);
    const current = await checkMicrophonePermission();
    const granted =
      current === 'granted' ? true : (await requestMicrophonePermission()) === 'granted';

    if (!granted) {
      setPhase('permission-denied');
      return;
    }

    await activateRecordingAudioMode();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
  }

  function handlePauseRecording() {
    recorder.pause();
    setPhase('paused');
  }

  function handleResumeRecording() {
    setErrorMessage(null);
    recorder.record();
    setPhase('recording');
  }

  async function handleStopRecording() {
    setPhase('stopping');
    await recorder.stop();
    await deactivateRecordingAudioMode();

    const uri = recorder.uri;
    if (!uri) {
      setPhase('failed');
      setErrorMessage('Não foi possível localizar o arquivo gravado.');
      return;
    }

    const fileInfo = getRecordingFileInfo(uri);
    const meetingDate = getTodayDateStringUtc();
    fileInfoRef.current = fileInfo;
    meetingDateRef.current = meetingDate;

    await savePendingRecording({
      uri: fileInfo.uri,
      fileSize: fileInfo.fileSize,
      contentType: fileInfo.contentType,
      durationMs: recorderState.durationMillis,
      meetingDate,
      savedAt: Date.now(),
    });

    void handleUploadAndProcess();
  }

  async function handleDiscardRecovery() {
    if (pendingRecovery) deleteRecordingFile(pendingRecovery.uri);
    await clearPendingRecording();
    setPendingRecovery(null);
  }

  function handleResumeRecovery() {
    if (!pendingRecovery) return;
    fileInfoRef.current = {
      uri: pendingRecovery.uri,
      fileSize: pendingRecovery.fileSize,
      contentType: pendingRecovery.contentType,
    };
    meetingDateRef.current = pendingRecovery.meetingDate;
    setPendingRecovery(null);
    void handleUploadAndProcess();
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
      ]}
    >
      <ThemedText variant="title2">Gravar</ThemedText>

      {netInfo.isConnected === false && (
        <Banner text="Sem conexão à internet. O upload será retomado automaticamente." />
      )}

      {whatsappGate?.blocked && (
        <Banner text="Configure um número de WhatsApp na sua conta para gravar reuniões." />
      )}

      {pendingRecovery && phase === 'idle' && (
        <RecoveryBanner onResume={handleResumeRecovery} onDiscard={() => void handleDiscardRecovery()} />
      )}

      {phase === 'idle' && (
        <IdleView
          disabled={Boolean(whatsappGate?.blocked)}
          onStart={() => void handleStartRecording()}
        />
      )}
      {phase === 'permission-denied' && <PermissionDeniedView />}
      {(phase === 'recording' || phase === 'paused') && (
        <RecordingView
          phase={phase}
          durationMs={recorderState.durationMillis}
          errorMessage={errorMessage}
          onPause={handlePauseRecording}
          onResume={handleResumeRecording}
          onStop={() => void handleStopRecording()}
        />
      )}
      {phase === 'stopping' && <StatusView label="Finalizando gravação..." />}
      {phase === 'uploading' && <UploadingView progress={uploadProgress} />}
      {phase === 'processing' && <StatusView label={STEP_LABELS[PROCESSING_STEP_IDS[stepIndex]]} />}
      {phase === 'done' && <StatusView label="Pronto! Redirecionando..." />}
      {phase === 'failed' && (
        <FailedView message={errorMessage} onRetry={() => void handleUploadAndProcess()} />
      )}
    </ScrollView>
  );
}

// ─── Effects (extracted to keep the component body short) ────────────────────

function useLoadInitialState(deps: {
  setWhatsappGate: (gate: WhatsappGate) => void;
  setPendingRecovery: (pending: PendingRecording | null) => void;
}) {
  useEffect(() => {
    fetchAccountWhatsappDefaults()
      .then((defaults) => deps.setWhatsappGate(resolveWhatsappGate(defaults)))
      .catch(() => deps.setWhatsappGate({ blocked: false, whatsappNumber: '' }));

    loadPendingRecording().then(deps.setPendingRecovery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// expo-audio (SDK 54) does not expose a dedicated interruption begin/end event
// in its public JS API. We treat "the recorder was in the `recording` phase
// but `isRecording` flipped to false without an explicit user action" as the
// interruption signal — this covers phone calls, another app taking the
// microphone, and the OS pausing recording while backgrounded. Because
// `useAudioRecorderState` polls the recorder continuously regardless of
// `AppState`, this single check also covers app minimize/foreground
// transitions without a separate `AppState` listener.
function useInterruptionReconciliation(args: {
  phase: Phase;
  isRecording: boolean;
  setPhase: (phase: Phase) => void;
  setErrorMessage: (message: string | null) => void;
}) {
  useEffect(() => {
    if (args.phase === 'recording' && !args.isRecording) {
      args.setPhase('paused');
      args.setErrorMessage(
        'A gravação foi interrompida (chamada, outro app usou o microfone ou o app foi para segundo plano).'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.isRecording, args.phase]);
}

function useNetworkRetry(args: { phase: Phase; isConnected: boolean | null; onRetry: () => void }) {
  const wasOffline = useRef(false);

  useEffect(() => {
    if (args.isConnected === false) {
      wasOffline.current = true;
    } else if (args.isConnected === true && wasOffline.current && args.phase === 'failed') {
      wasOffline.current = false;
      args.onRetry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.isConnected, args.phase]);
}

// `stopPollingRef` holds a plain callback (not a DOM node), so its `.current`
// is intentionally read at cleanup time to stop whatever polling loop is
// active when the screen unmounts.
function usePollingCleanup(stopPollingRef: MutableRefObject<(() => void) | null>) {
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => stopPollingRef.current?.();
  }, [stopPollingRef]);
}

// ─── Presentational pieces ────────────────────────────────────────────────────

function Banner({ text }: { text: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.warning + '26', borderRadius: radius.md, padding: spacing.sm + 2 },
      ]}
    >
      <ThemedText variant="footnote" color={colors.warning}>
        {text}
      </ThemedText>
    </View>
  );
}

function RecoveryBanner({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  const { spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <ThemedText variant="headline">Encontramos uma gravação anterior</ThemedText>
      <ThemedText variant="body" style={styles.cardSubtitle}>
        O envio foi interrompido antes de terminar. Quer retomar?
      </ThemedText>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Button label="Retomar envio" onPress={onResume} style={styles.flexButton} />
        <Button label="Descartar" variant="secondary" onPress={onDiscard} style={styles.flexButton} />
      </View>
    </Card>
  );
}

function IdleView({ disabled, onStart }: { disabled: boolean; onStart: () => void }) {
  const { spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <ThemedText variant="headline">Pronto para gravar</ThemedText>
      <ThemedText variant="body" style={styles.cardSubtitle}>
        Toque no botão para começar. Você pode bloquear a tela — a gravação continua.
      </ThemedText>
      <Button label="Gravar" onPress={onStart} disabled={disabled} />
    </Card>
  );
}

function PermissionDeniedView() {
  const { spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <ThemedText variant="headline">Permissão de microfone necessária</ThemedText>
      <ThemedText variant="body" style={styles.cardSubtitle}>
        O Notura precisa acessar o microfone para gravar suas reuniões. Ative a permissão nas
        Configurações do sistema.
      </ThemedText>
      <Button label="Abrir Configurações" onPress={() => void openMicrophoneSettings()} />
    </Card>
  );
}

function RecordingView({
  phase,
  durationMs,
  errorMessage,
  onPause,
  onResume,
  onStop,
}: {
  phase: 'recording' | 'paused';
  durationMs: number;
  errorMessage: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <ThemedText variant="display" style={styles.timer}>
        {formatDuration(durationMs)}
      </ThemedText>
      <ThemedText variant="body" color={colors.mutedForeground} style={styles.cardSubtitle}>
        {phase === 'recording' ? 'Gravando...' : 'Pausado'}
      </ThemedText>
      {errorMessage && (
        <ThemedText variant="footnote" color={colors.error}>
          {errorMessage}
        </ThemedText>
      )}
      <View style={[styles.row, { gap: spacing.sm }]}>
        {phase === 'recording' ? (
          <Button label="Pausar" variant="secondary" onPress={onPause} style={styles.flexButton} />
        ) : (
          <Button label="Retomar" variant="secondary" onPress={onResume} style={styles.flexButton} />
        )}
        <Button label="Finalizar" onPress={onStop} style={styles.flexButton} />
      </View>
    </Card>
  );
}

function UploadingView({ progress }: { progress: number }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <ThemedText variant="headline">Enviando áudio...</ThemedText>
      <View style={[styles.progressTrack, { backgroundColor: colors.secondary, borderRadius: radius.sm }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress}%`, backgroundColor: colors.primary, borderRadius: radius.sm },
          ]}
        />
      </View>
      <ThemedText variant="body" style={styles.cardSubtitle}>
        {progress}%
      </ThemedText>
    </Card>
  );
}

function StatusView({ label }: { label: string }) {
  const { spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <ThemedText variant="headline">{label}</ThemedText>
    </Card>
  );
}

function FailedView({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  const { spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <ThemedText variant="headline">Erro no envio</ThemedText>
      <ThemedText variant="body" style={styles.cardSubtitle}>
        {message ?? 'Algo deu errado. Tente novamente.'}
      </ThemedText>
      <Button label="Tentar novamente" onPress={onRetry} />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  banner: {},
  cardSubtitle: {
    lineHeight: 17 * 1.4,
  },
  timer: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  flexButton: {
    flex: 1,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
  },
});
