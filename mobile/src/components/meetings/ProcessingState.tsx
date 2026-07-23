import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { MeetingStatusPayload } from "@/lib/meetings/status";

interface ProcessingStateProps {
  payload: MeetingStatusPayload;
  onCancel?: () => void;
  isCanceling?: boolean;
}

function ProcessingStepLabel({ step }: { step: string | null }) {
  if (!step) return null;

  const labels: Record<string, string> = {
    "update-status-processing": "Preparando reunião...",
    transcribe: "Transcrevendo áudio...",
    summarize: "Gerando resumo...",
    extract: "Extraindo tarefas e decisões...",
    cleanup: "Finalizando...",
  };

  return <Text style={styles.step}>{labels[step] ?? step}</Text>;
}

export function ProcessingState({
  payload,
  onCancel,
  isCanceling,
}: ProcessingStateProps) {
  const title = payload.title ?? "Reunião";

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.title}>Processando {title}</Text>
      <ProcessingStepLabel step={payload.processingStep} />
      <Text style={styles.subtitle}>
        O resumo, a transcrição e as tarefas serão gerados em instantes.
      </Text>

      {onCancel ? (
        <Pressable
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={isCanceling}
        >
          <Text style={styles.cancelText}>
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
    color: "#0f172a",
    marginTop: 16,
  },
  step: {
    fontSize: 14,
    color: "#2563eb",
    marginTop: 8,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  cancelText: {
    color: "#dc2626",
    fontWeight: "600",
  },
});
