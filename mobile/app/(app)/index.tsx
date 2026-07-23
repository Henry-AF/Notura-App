import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  fetchMeetings,
  type FetchMeetingsOptions,
  type MeetingListItem,
} from "@/lib/meetings/meetings-api";
import { fetchMeetingGroups, type MeetingGroup } from "@/lib/meetings/groups-api";
import { MeetingListItemView } from "@/components/meetings/MeetingListItem";
import { MeetingFilterSheet } from "@/components/meetings/MeetingFilterSheet";

const PAGE_LIMIT = 20;

export default function MeetingsScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<MeetingGroup[]>([]);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      setGroupsError(null);
      const data = await fetchMeetingGroups();
      setGroups(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar grupos.";
      console.error("[MeetingsScreen] Failed to load groups:", err);
      setGroupsError(message);
    }
  }, []);

  const loadMeetings = useCallback(
    async (options: FetchMeetingsOptions = {}, append = false) => {
      try {
        setError(null);
        const page = await fetchMeetings({ ...options, limit: PAGE_LIMIT });

        setMeetings((previous) => (append ? [...previous, ...page.meetings] : page.meetings));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar reuniões.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    void loadMeetings({ groupId: selectedGroupId }, false);
  }, [loadMeetings, selectedGroupId]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !nextCursor) return;

    setIsLoadingMore(true);
    void loadMeetings({ groupId: selectedGroupId, cursor: nextCursor }, true);
  }, [isLoadingMore, nextCursor, loadMeetings, selectedGroupId]);

  useEffect(() => {
    setIsLoading(true);
    void loadMeetings({ groupId: selectedGroupId });
    void loadGroups();
  }, [loadMeetings, loadGroups, selectedGroupId]);

  const handleMeetingPress = useCallback(
    (meeting: MeetingListItem) => {
      router.push(`/(app)/meetings/${meeting.id}`);
    },
    [router]
  );

  const selectedGroupName =
    selectedGroupId === null
      ? "Todos"
      : groups.find((group) => group.id === selectedGroupId)?.name ?? "Grupo";

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reuniões</Text>
        <Pressable style={styles.filterButton} onPress={() => setIsFilterOpen(true)}>
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {selectedGroupName}
          </Text>
        </Pressable>
      </View>

      {groupsError ? (
        <View style={styles.groupsErrorBanner}>
          <Text style={styles.groupsErrorText}>Filtro por grupo indisponível: {groupsError}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={meetings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MeetingListItemView meeting={item} onPress={handleMeetingPress} />
        )}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore ? <ActivityIndicator style={styles.loader} /> : null
        }
        ListEmptyComponent={
          !error ? (
            <Text style={styles.empty}>
              {selectedGroupId
                ? "Nenhuma reunião encontrada para este grupo."
                : "Você ainda não possui reuniões."}
            </Text>
          ) : null
        }
      />

      <MeetingFilterSheet
        visible={isFilterOpen}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        onClose={() => setIsFilterOpen(false)}
      />
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  filterButton: {
    maxWidth: 160,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  filterButtonText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  groupsErrorBanner: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#fee2e2",
  },
  groupsErrorText: {
    fontSize: 12,
    color: "#dc2626",
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
  loader: {
    marginVertical: 16,
  },
  empty: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
