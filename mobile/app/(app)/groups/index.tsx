import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  createGroup,
  fetchGroupsSnapshot,
  type MeetingGroupItem,
} from "@/lib/meetings/groups-api";
import { colors } from "@/lib/theme/tokens";
import { GroupFormSheet } from "@/components/groups/GroupFormSheet";

type ViewMode = "active" | "archived";

export default function GroupsScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [groups, setGroups] = useState<MeetingGroupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const snapshot = await fetchGroupsSnapshot(true);
      setGroups(snapshot.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar grupos.");
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

  async function handleCreate(name: string) {
    const created = await createGroup(name);
    setIsCreateOpen(false);
    await load();
    router.push(`/(app)/groups/${created.id}`);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const visibleGroups = groups.filter((group) =>
    viewMode === "active" ? !group.archivedAt : Boolean(group.archivedAt)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Grupos</Text>
        <Pressable style={styles.addButton} onPress={() => setIsCreateOpen(true)}>
          <Text style={styles.addButtonText}>+ Novo grupo</Text>
        </Pressable>
      </View>

      <View style={styles.toggleRow}>
        {(["active", "archived"] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.toggleButton, viewMode === mode && styles.toggleButtonActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
              {mode === "active" ? "Ativos" : "Arquivados"}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        {visibleGroups.length === 0 ? (
          <Text style={styles.empty}>
            {viewMode === "active"
              ? "Nenhum grupo criado. Crie grupos para organizar reuniões por cliente, projeto ou área."
              : "Nenhum grupo arquivado."}
          </Text>
        ) : (
          visibleGroups.map((group) => (
            <Pressable
              key={group.id}
              style={styles.card}
              onPress={() => router.push(`/(app)/groups/${group.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{group.name.trim()[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={styles.cardMeta}>{group.meetingsCount} reuniões</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      {isCreateOpen ? (
        <GroupFormSheet
          title="Criar grupo"
          initialName=""
          onSave={handleCreate}
          onClose={() => setIsCreateOpen(false)}
        />
      ) : null}
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addButtonText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card2,
  },
  toggleButtonActive: {
    backgroundColor: "rgba(139,122,255,0.18)",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  toggleTextActive: {
    color: colors.primary,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,107,107,0.12)",
  },
  errorText: {
    fontSize: 12,
    color: colors.destructive,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  empty: {
    textAlign: "center",
    color: colors.mutedForeground,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(139,122,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: colors.mutedForeground,
  },
});
