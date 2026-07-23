import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  fetchMeetingDetail,
  formatMeetingDateTime,
  type MeetingDetail,
} from "@/lib/meetings/meeting-detail-api";
import {
  cancelMeetingProcessing,
  fetchMeetingStatus,
  retryMeetingProcessing,
  type MeetingStatusPayload,
} from "@/lib/meetings/status";
import { shareMeetingAta } from "@/lib/meetings/export-ata";
import { MeetingDetailTabs } from "@/components/meetings/MeetingDetailTabs";
import { ProcessingState } from "@/components/meetings/ProcessingState";
import { FailedState } from "@/components/meetings/FailedState";
import { MeetingStatusBadge } from "@/components/meetings/MeetingStatusBadge";

const POLLING_INTERVAL_MS = 30_000;

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [status, setStatus] = useState<MeetingStatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      setError(null);
      const detail = await fetchMeetingDetail(id);
      setMeeting(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar reunião.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const loadStatus = useCallback(async () => {
    try {
      const currentStatus = await fetchMeetingStatus(id);
      setStatus(currentStatus);
      return currentStatus;
    } catch (err) {
      console.error("Failed to poll meeting status:", err);
      return null;
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    void loadDetail();
    void loadStatus();
  }, [loadDetail, loadStatus]);

  useEffect(() => {
    const effectiveStatus = status?.status ?? meeting?.status;
    if (effectiveStatus !== "processing" && effectiveStatus !== "pending") return;

    const interval = setInterval(() => {
      void (async () => {
        const currentStatus = await loadStatus();
        if (currentStatus && currentStatus.status === "completed") {
          await loadDetail();
        }
      })();
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadDetail, loadStatus, meeting?.status, status?.status]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await retryMeetingProcessing(id);
      setStatus((previous) =>
        previous ? { ...previous, status: "processing" } : null
      );
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao reprocessar.");
    } finally {
      setIsRetrying(false);
    }
  }, [id]);

  const handleCancel = useCallback(async () => {
    setIsCanceling(true);
    try {
      await cancelMeetingProcessing(id);
      setStatus((previous) =>
        previous ? { ...previous, status: "failed" } : null
      );
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao cancelar.");
    } finally {
      setIsCanceling(false);
    }
  }, [id]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      await shareMeetingAta(id);
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Erro ao compartilhar ata.");
    } finally {
      setIsSharing(false);
    }
  }, [id]);

  const effectiveStatus = status?.status ?? meeting?.status ?? "processing";
  const displayStatus = effectiveStatus === "pending" ? "processing" : effectiveStatus;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error || !meeting) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error ?? "Reunião não encontrada."}</Text>
        <Pressable style={styles.retryButton} onPress={loadDetail}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isProcessing = displayStatus === "processing";
  const isFailed = displayStatus === "failed";
  const isCompleted = displayStatus === "completed";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Voltar</Text>
        </Pressable>
        {isCompleted ? (
          <Pressable onPress={handleShare} disabled={isSharing}>
            <Text style={styles.share}>{isSharing ? "Abrindo..." : "Compartilhar"}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {meeting.clientName}
          </Text>
          <MeetingStatusBadge status={displayStatus} />
        </View>

        <Text style={styles.date}>{formatMeetingDateTime(meeting.meetingDate)}</Text>

        {isProcessing ? (
          <ProcessingState
            payload={status ?? { id, title: meeting.clientName, status: "processing", processingStep: null, jobStatus: null, errorMessage: null, taskCount: 0, decisionCount: 0 }}
            onCancel={handleCancel}
            isCanceling={isCanceling}
          />
        ) : null}

        {isFailed ? (
          <FailedState
            errorMessage={status?.errorMessage}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        ) : null}

        {isCompleted ? <MeetingDetailTabs meeting={meeting} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  back: {
    fontSize: 14,
    color: "#64748b",
  },
  share: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  date: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    color: "#dc2626",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
});
