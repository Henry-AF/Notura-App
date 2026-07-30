import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
import type { MeetingStatusPayload } from "@/lib/meetings/status";

interface ProcessingStateProps {
  payload: MeetingStatusPayload;
  onCancel?: () => void;
  isCanceling?: boolean;
}

const PROCESSING_STEP_LABELS: Record<string, string> = {
  "update-status-processing": "Preparando reunião...",
  transcribe: "Transcrevendo áudio...",
  summarize: "Gerando resumo...",
  extract: "Extraindo tarefas e decisões...",
  cleanup: "Finalizando...",
};

function ProcessingStepLabel({ step, color }: { step: string | null; color: string }) {
  if (!step) return null;

  return <Text style={[styles.step, { color }]}>{PROCESSING_STEP_LABELS[step] ?? step}</Text>;
}

export function ProcessingState({
  payload,
  onCancel,
  isCanceling,
}: ProcessingStateProps) {
  const { colors } = useTheme();
  const title = payload.title ?? "Reunião";

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.processing} />
      <Text style={[styles.title, { color: colors.foreground }]}>Processando {title}</Text>
      <ProcessingStepLabel step={payload.processingStep} color={colors.processing} />
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        O resumo, a transcrição e as tarefas serão gerados em instantes.
      </Text>

      {onCancel ? (
        <Pressable
          style={[styles.cancelButton, { borderColor: colors.error }]}
          onPress={onCancel}
          disabled={isCanceling}
        >
          <Text style={[styles.cancelText, { color: colors.error }]}>
            {isCanceling ? "Cancelando..." : "Cancelar processamento"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },
  step: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: {
    fontWeight: "600",
  },
});
