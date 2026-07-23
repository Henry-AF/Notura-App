import { Pressable, StyleSheet, Text, View } from "react-native";

interface FailedStateProps {
  errorMessage?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function FailedState({ errorMessage, onRetry, isRetrying }: FailedStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Falha no processamento</Text>
      <Text style={styles.subtitle}>
        {errorMessage && errorMessage.trim().length > 0
          ? errorMessage
          : "O arquivo foi salvo. Você pode tentar processar novamente."}
      </Text>

      {onRetry ? (
        <Pressable style={styles.retryButton} onPress={onRetry} disabled={isRetrying}>
          <Text style={styles.retryText}>
            {isRetrying ? "Reprocessando..." : "Reprocessar reunião"}
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
    color: "#dc2626",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
});
