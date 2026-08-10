import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FailedState } from "@/components/meetings/FailedState";
import { ProcessingState } from "@/components/meetings/ProcessingState";
import type { MeetingStatusPayload } from "@/lib/meetings/status";
import { colors } from "@/lib/theme/tokens";
import {
  cancelProcessing,
  fetchProcessingStatus,
  getMeetingDetailRoute,
  PROCESSING_POLL_INTERVAL_MS,
  retryProcessing,
} from "./processing-api";

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { payload, error, loadStatus } = useProcessingStatus(id, router);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await retryProcessing(id);
      await loadStatus();
    } catch (cause) {
      Alert.alert("Erro", cause instanceof Error ? cause.message : "Erro ao reprocessar.");
    } finally {
      setIsRetrying(false);
    }
  }, [id, loadStatus]);

  const handleCancel = useCallback(async () => {
    setIsCanceling(true);
    try {
      await cancelProcessing(id);
      await loadStatus();
    } catch (cause) {
      Alert.alert("Erro", cause instanceof Error ? cause.message : "Erro ao cancelar.");
    } finally {
      setIsCanceling(false);
    }
  }, [id, loadStatus]);

  return (
    <ProcessingContent
      payload={payload}
      error={error}
      isRetrying={isRetrying}
      isCanceling={isCanceling}
      onLoad={loadStatus}
      onRetry={handleRetry}
      onCancel={handleCancel}
    />
  );
}

function useProcessingStatus(id: string, router: ReturnType<typeof useRouter>) {
  const [payload, setPayload] = useState<MeetingStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadStatus = useCallback(async () => {
    try {
      const next = await fetchProcessingStatus(id);
      setPayload(next);
      setError(null);
      if (next.status === "completed") router.replace(getMeetingDetailRoute(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao acompanhar processamento.");
    }
  }, [id, router]);

  useEffect(() => {
    void loadStatus();
    const timer = setInterval(() => void loadStatus(), PROCESSING_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadStatus]);

  return { payload, error, loadStatus };
}

interface ProcessingContentProps {
  payload: MeetingStatusPayload | null;
  error: string | null;
  isRetrying: boolean;
  isCanceling: boolean;
  onLoad: () => Promise<void>;
  onRetry: () => Promise<void>;
  onCancel: () => Promise<void>;
}

function ProcessingContent(props: ProcessingContentProps) {
  if (props.error && !props.payload) {
    return <LoadError message={props.error} onRetry={() => void props.onLoad()} />;
  }
  if (!props.payload) {
    return <LoadingState />;
  }
  return (
    <SafeAreaView style={styles.container}>
      {props.payload.status === "failed" ? (
        <FailedState
          errorMessage={props.payload.errorMessage}
          onRetry={() => void props.onRetry()}
          isRetrying={props.isRetrying}
        />
      ) : (
        <ProcessingState
          payload={props.payload}
          onCancel={() => void props.onCancel()}
          isCanceling={props.isCanceling}
        />
      )}
    </SafeAreaView>
  );
}

function LoadingState() {
  return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </SafeAreaView>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.error}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Tentar novamente</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  error: { color: colors.destructive, fontSize: 14, textAlign: "center" },
  retryButton: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: { color: colors.primaryForeground, fontWeight: "600" },
});
