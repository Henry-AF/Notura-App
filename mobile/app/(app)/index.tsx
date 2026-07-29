import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  fetchDashboardOverview,
  retryDashboardMeeting,
  type DashboardMeeting,
} from "@/lib/dashboard/dashboard-api";
import { colors } from "@/lib/theme/tokens";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { BannerCarousel } from "@/components/home/BannerCarousel";
import { QuickActionCard } from "@/components/home/QuickActionCard";
import { RecentMeetingsCard } from "@/components/home/RecentMeetingsCard";
import { InsightCard } from "@/components/home/InsightCard";

// Mirrors `QUICK_ACTIONS` in the web app's `src/app/dashboard/dashboard-client.tsx`.
const QUICK_ACTIONS = [
  { label: "Gravar Reunião Presencial", color: "#6851FF", mode: undefined },
  { label: "Gravar Reunião Remota", color: "#059669", mode: "remote" },
  { label: "Processar Reunião Gravada", color: "#F59E0B", mode: "upload" },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [todayCount, setTodayCount] = useState(0);
  const [meetings, setMeetings] = useState<DashboardMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const overview = await fetchDashboardOverview();
      setUserName(overview.userName);
      setTodayCount(overview.todayCount);
      setMeetings(overview.recentMeetings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o dashboard.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    void load();
  }, [load]);

  const handleRetry = useCallback(
    async (id: string) => {
      setMeetings((previous) =>
        previous.map((meeting) =>
          meeting.id === id ? { ...meeting, status: "processing" as const } : meeting
        )
      );
      try {
        await retryDashboardMeeting(id);
      } catch {
        Alert.alert("Erro ao reprocessar. Tente novamente.");
      }
    },
    []
  );

  const goToMeeting = useCallback(
    (id: string) => router.push(`/(app)/meetings/${id}`),
    [router]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <GreetingHeader userName={userName} meetingsProcessedToday={todayCount} />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <BannerCarousel />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Como sua reunião vai ser feita hoje?</Text>
          <View style={styles.quickActionsRow}>
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCard
                key={action.label}
                label={action.label}
                color={action.color}
                onPress={() =>
                  router.push(
                    action.mode
                      ? { pathname: "/(app)/record", params: { mode: action.mode } }
                      : "/(app)/record"
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <RecentMeetingsCard
            meetings={meetings}
            onViewAll={() => router.push("/(app)/meetings")}
            onRetry={handleRetry}
            onViewProcessing={goToMeeting}
            onRowPress={goToMeeting}
          />
        </View>

        <View style={styles.section}>
          <InsightCard
            title="Dicas de produtividade"
            body="Agende suas reuniões mais importantes pela manhã — você terá mais energia e foco para tomar decisões estratégicas."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 10,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,107,107,0.12)",
  },
  errorText: {
    fontSize: 12,
    color: "#FF6B6B",
  },
});
