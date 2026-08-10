import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { normalizeMeteringDb, smoothAmplitude } from '@/lib/audio/metering';
import { VoiceWaveform } from '@/components/recording/VoiceWaveform';
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
  fetchAccountWhatsappDefaults,
  getTodayDateStringUtc,
  resolveWhatsappGate,
  submitMeetingRecording,
  type WhatsappGate,
} from './record-api';

type Phase =
  | 'idle'
  | 'permission-denied'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'uploading'
  | 'failed';

// Poll fast enough for the waveform (NOT-121) to feel smooth — `Animated`
// interpolates between updates, so this doesn't need to match a render's
// frame rate, just be short enough that steps aren't visible.
const METERING_POLL_INTERVAL_MS = 100;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RecordScreen() {
  const router = useRouter();
  const netInfo = useNetInfo();

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [whatsappGate, setWhatsappGate] = useState<WhatsappGate | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecording | null>(null);

  const recorder = useAudioRecorder(getRecordingOptions(), (status) => {
    if (status.hasError) {
      setErrorMessage(status.error ?? 'A gravação foi interrompida.');
    }
  });
  const recorderState = useAudioRecorderState(recorder, METERING_POLL_INTERVAL_MS);
  const amplitude = useVoiceAmplitude(recorderState.metering);

  const fileInfoRef = useRef<RecordingFileInfo | null>(null);
  const meetingDateRef = useRef<string | null>(null);

  useLoadInitialState({ setWhatsappGate, setPendingRecovery });
  useInterruptionReconciliation({ phase, isRecording: recorderState.isRecording, setPhase, setErrorMessage });
  useNetworkRetry({ phase, isConnected: netInfo.isConnected, onRetry: () => void handleUploadAndProcess() });

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
      deleteRecordingFile(fileInfo.uri);
      // NOT-180 supersedes the earlier web-parity choice from ce32989:
      // mobile intentionally uses a dedicated post-upload processing screen.
      router.replace(`/(app)/processing/${meetingId}`);
    } catch (error) {
      setPhase('failed');
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao enviar a gravação.');
    }
  }, [whatsappGate, router]);

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Gravar</Text>

      {netInfo.isConnected === false && (
        <Banner text="Sem conexão à internet. O upload será retomado automaticamente." tone="warning" />
      )}

      {whatsappGate?.blocked && (
        <Banner
          text="Configure um número de WhatsApp na sua conta para gravar reuniões."
          tone="warning"
        />
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
          amplitude={amplitude}
          errorMessage={errorMessage}
          onPause={handlePauseRecording}
          onResume={handleResumeRecording}
          onStop={() => void handleStopRecording()}
        />
      )}
      {phase === 'stopping' && <StatusView label="Finalizando gravação..." />}
      {phase === 'uploading' && <UploadingView progress={uploadProgress} />}
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

// Converts the raw dB metering reading polled off the recorder into a
// smoothed [0, 1] amplitude for `VoiceWaveform` (NOT-121). The running
// smoothed value lives in a ref (not state) so it updates in step with
// `recorderState` without causing an extra render of its own. `undefined`
// means expo-audio hasn't reported metering yet (see expo/expo#37241) —
// treated the same as `null` so the UI can show an honest idle state
// instead of pretending to react to voice it isn't measuring.
const AMPLITUDE_MIN_DB = -60;
const AMPLITUDE_SMOOTHING = 0.35;

function useVoiceAmplitude(metering: number | null | undefined): number | null {
  const smoothedRef = useRef<number | null>(null);

  if (metering === null || metering === undefined) {
    smoothedRef.current = null;
    return null;
  }

  const normalized = normalizeMeteringDb(metering, { minDb: AMPLITUDE_MIN_DB });
  const previous = smoothedRef.current ?? normalized;
  smoothedRef.current = smoothAmplitude(previous, normalized, AMPLITUDE_SMOOTHING);
  return smoothedRef.current;
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

// ─── Presentational pieces ────────────────────────────────────────────────────

function Banner({ text, tone }: { text: string; tone: 'warning' }) {
  return (
    <View style={[styles.banner, tone === 'warning' && styles.bannerWarning]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

function RecoveryBanner({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Encontramos uma gravação anterior</Text>
      <Text style={styles.cardSubtitle}>
        O envio foi interrompido antes de terminar. Quer retomar?
      </Text>
      <View style={styles.row}>
        <PrimaryButton label="Retomar envio" onPress={onResume} />
        <SecondaryButton label="Descartar" onPress={onDiscard} />
      </View>
    </View>
  );
}

function IdleView({ disabled, onStart }: { disabled: boolean; onStart: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pronto para gravar</Text>
      <Text style={styles.cardSubtitle}>
        Toque no botão para começar. Você pode bloquear a tela — a gravação continua.
      </Text>
      <PrimaryButton label="Gravar" onPress={onStart} disabled={disabled} />
    </View>
  );
}

function PermissionDeniedView() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Permissão de microfone necessária</Text>
      <Text style={styles.cardSubtitle}>
        O Notura precisa acessar o microfone para gravar suas reuniões. Ative a permissão nas
        Configurações do sistema.
      </Text>
      <PrimaryButton label="Abrir Configurações" onPress={() => void openMicrophoneSettings()} />
    </View>
  );
}

function RecordingView({
  phase,
  durationMs,
  amplitude,
  errorMessage,
  onPause,
  onResume,
  onStop,
}: {
  phase: 'recording' | 'paused';
  durationMs: number;
  amplitude: number | null;
  errorMessage: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.timer}>{formatDuration(durationMs)}</Text>
      <VoiceWaveform amplitude={amplitude} active={phase === 'recording'} />
      <Text style={styles.cardSubtitle}>
        {phase === 'recording' ? 'Gravando...' : 'Pausado'}
      </Text>
      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      <View style={styles.row}>
        {phase === 'recording' ? (
          <SecondaryButton label="Pausar" onPress={onPause} />
        ) : (
          <SecondaryButton label="Retomar" onPress={onResume} />
        )}
        <PrimaryButton label="Finalizar" onPress={onStop} />
      </View>
    </View>
  );
}

function UploadingView({ progress }: { progress: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Enviando áudio...</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.cardSubtitle}>{progress}%</Text>
    </View>
  );
}

function StatusView({ label }: { label: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
    </View>
  );
}

function FailedView({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Erro no envio</Text>
      <Text style={styles.cardSubtitle}>{message ?? 'Algo deu errado. Tente novamente.'}</Text>
      <PrimaryButton label="Tentar novamente" onPress={onRetry} />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && styles.pressedScale,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedScale]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

// ─── Design tokens (see DESIGN.md) ────────────────────────────────────────────

const ACCENT_PRIMARY = '#5E4CEB';
const ACCENT_SECONDARY = 'rgba(83, 65, 205, 0.12)';
const GRAY_50 = '#FBFBFE';
const GRAY_100 = '#F2F2F7';
const GRAY_800 = '#1C1C1E';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    backgroundColor: GRAY_50,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.02 * 28,
    color: GRAY_800,
  },
  banner: {
    borderRadius: 14,
    padding: 14,
  },
  bannerWarning: {
    backgroundColor: '#FEF3C7',
  },
  bannerText: {
    fontSize: 13,
    color: '#92400E',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.01 * 17,
    color: GRAY_800,
  },
  cardSubtitle: {
    fontSize: 17,
    color: '#6B7280',
    lineHeight: 17 * 1.4,
  },
  timer: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.04 * 44,
    color: GRAY_800,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: GRAY_100,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_PRIMARY,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: ACCENT_PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: ACCENT_SECONDARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: ACCENT_PRIMARY,
    fontSize: 17,
    fontWeight: '600',
  },
  pressedScale: {
    transform: [{ scale: 0.96 }],
  },
});
