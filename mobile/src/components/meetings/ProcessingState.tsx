import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { PROCESSING_STEPS, getProcessingStepIndex, type MeetingStatusPayload } from "@/lib/meetings/status";
import { colors } from "@/lib/theme/tokens";

interface ProcessingStateProps {
  payload: MeetingStatusPayload;
  onCancel?: () => void;
  isCanceling?: boolean;
}

export function ProcessingState({ payload, onCancel, isCanceling }: ProcessingStateProps) {
  const title = payload.title ?? "Reunião";
  const currentIndex = getProcessingStepIndex(payload.processingStep);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.title}>Processando {title}</Text>
      <Text style={styles.subtitle}>
        O resumo, a transcrição e as tarefas serão gerados em instantes.
      </Text>

      <View style={styles.steps}>
        {PROCESSING_STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <View key={step.id} style={styles.stepRow}>
              <View
                style={[
                  styles.stepMarker,
                  isDone && styles.stepMarkerDone,
                  isCurrent && styles.stepMarkerCurrent,
                ]}
              >
                {isDone ? <Text style={styles.stepMarkerCheck}>✓</Text> : null}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isCurrent && styles.stepLabelCurrent,
                  isDone && styles.stepLabelDone,
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {onCancel ? (
        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={isCanceling}>
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
    color: colors.foreground,
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 8,
    textAlign: "center",
  },
  steps: {
    marginTop: 28,
    alignSelf: "stretch",
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepMarkerDone: {
    backgroundColor: "#4ECB71",
    borderColor: "#4ECB71",
  },
  stepMarkerCurrent: {
    borderColor: colors.primary,
  },
  stepMarkerCheck: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  stepLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  stepLabelCurrent: {
    color: colors.foreground,
    fontWeight: "700",
  },
  stepLabelDone: {
    color: colors.secondaryForeground,
  },
  cancelButton: {
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.35)",
  },
  cancelText: {
    color: colors.destructive,
    fontWeight: "600",
  },
});
