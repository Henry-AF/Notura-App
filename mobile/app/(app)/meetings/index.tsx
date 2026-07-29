import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  fetchMeetings,
  type FetchMeetingsOptions,
  type MeetingListItem,
} from "@/lib/meetings/meetings-api";
import { fetchMeetingGroups, type MeetingGroup } from "@/lib/meetings/groups-api";
import { MeetingListItemView } from "@/components/meetings/MeetingListItem";
import { MeetingFilterSheet } from "@/components/meetings/MeetingFilterSheet";
import { useTheme } from "@/theme";
import { Screen } from "@/components/ui/Screen";
import { ThemedText } from "@/components/ui/ThemedText";

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

  const { colors, radius, spacing } = useTheme();

  if (isLoading) {
    return (
      <Screen style={styles.center} padded={false}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} padded={false}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
        ]}
      >
        <ThemedText variant="title2">Reuniões</ThemedText>
        <Pressable
          style={[styles.filterButton, { backgroundColor: colors.secondary, borderRadius: radius.xl }]}
          onPress={() => setIsFilterOpen(true)}
        >
          <ThemedText variant="footnote" color={colors.secondaryForeground} numberOfLines={1}>
            {selectedGroupName}
          </ThemedText>
        </Pressable>
      </View>

      {groupsError ? (
        <View
          style={[
            styles.groupsErrorBanner,
            { backgroundColor: colors.error + "1A", borderBottomColor: colors.border },
          ]}
        >
          <ThemedText variant="caption" color={colors.error}>
            Filtro por grupo indisponível: {groupsError}
          </ThemedText>
        </View>
      ) : null}

      {error ? (
        <View style={styles.center}>
          <ThemedText variant="footnote" color={colors.error} style={styles.textCenter}>
            {error}
          </ThemedText>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary, borderRadius: radius.md }]}
            onPress={refresh}
          >
            <ThemedText variant="footnote" color={colors.primaryForeground}>
              Tentar novamente
            </ThemedText>
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
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null
        }
        ListEmptyComponent={
          !error ? (
            <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.empty}>
              {selectedGroupId
                ? "Nenhuma reunião encontrada para este grupo."
                : "Você ainda não possui reuniões."}
            </ThemedText>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderBottomWidth: 1,
  },
  filterButton: {
    maxWidth: 160,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  groupsErrorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  textCenter: {
    textAlign: "center",
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loader: {
    marginVertical: 16,
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
