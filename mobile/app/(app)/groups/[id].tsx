import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  assignMeetingToGroup,
  fetchGroupsSnapshot,
  renameGroup,
  setGroupArchived,
  type GroupMeeting,
  type MeetingGroupItem,
} from "@/lib/meetings/groups-api";
import type { MeetingStatus } from "@/lib/meetings/meetings-api";
import { colors } from "@/lib/theme/tokens";
import { MeetingStatusBadge } from "@/components/meetings/MeetingStatusBadge";
import { GroupFormSheet } from "@/components/groups/GroupFormSheet";

function toMeetingStatus(status: GroupMeeting["status"]): MeetingStatus {
  if (status === "scheduled") return "pending";
  return status;
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<MeetingGroupItem | null>(null);
  const [meetings, setMeetings] = useState<GroupMeeting[]>([]);
  const [addableMeetings, setAddableMeetings] = useState<GroupMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const snapshot = await fetchGroupsSnapshot(true);
      const found = snapshot.groups.find((g) => g.id === id) ?? null;
      setGroup(found);
      setMeetings(snapshot.meetings.filter((m) => m.groupId === id));
      setAddableMeetings(snapshot.meetings.filter((m) => m.groupId !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar grupo.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    void load();
  }, [load]);

  async function handleRename(name: string) {
    await renameGroup(id, name);
    setIsEditOpen(false);
    await load();
  }

  async function handleToggleArchive() {
    if (!group || isMutating) return;
    setIsMutating(true);
    try {
      await setGroupArchived(group.id, !group.archivedAt);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao arquivar grupo.");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAddMeeting(meetingId: string) {
    setIsPickerOpen(false);
    try {
      await assignMeetingToGroup(meetingId, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar reunião.");
    }
  }

  async function handleRemoveMeeting(meetingId: string) {
    setMeetings((previous) => previous.filter((m) => m.id !== meetingId));
    try {
      await assignMeetingToGroup(meetingId, null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover reunião.");
      await load();
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.error}>Grupo não encontrado.</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isArchived = Boolean(group.archivedAt);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>‹ Grupos</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.subtitle}>{meetings.length} reuniões neste grupo</Text>

        <View style={styles.actionsRow}>
          {isArchived ? (
            <Pressable style={styles.actionButton} onPress={() => void handleToggleArchive()}>
              <Text style={styles.actionButtonText}>Desarquivar</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.actionButton} onPress={() => setIsEditOpen(true)}>
                <Text style={styles.actionButtonText}>Editar</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => void handleToggleArchive()}>
                <Text style={styles.actionButtonText}>Arquivar</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => setIsPickerOpen(true)}
              >
                <Text style={styles.actionButtonPrimaryText}>+ Adicionar reunião</Text>
              </Pressable>
            </>
          )}
        </View>
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
        {meetings.length === 0 ? (
          <Text style={styles.empty}>
            Grupo vazio. Adicione reuniões existentes ou escolha este grupo ao criar uma nova
            reunião.
          </Text>
        ) : (
          meetings.map((meeting) => (
            <Pressable
              key={meeting.id}
              style={styles.meetingRow}
              onPress={() => router.push(`/(app)/meetings/${meeting.id}`)}
            >
              <View style={styles.meetingContent}>
                <Text style={styles.meetingTitle} numberOfLines={1}>
                  {meeting.title}
                </Text>
                <View style={styles.meetingMeta}>
                  <Text style={styles.meetingDate}>
                    {new Date(meeting.createdAt).toLocaleDateString("pt-BR")}
                  </Text>
                  <MeetingStatusBadge status={toMeetingStatus(meeting.status)} />
                </View>
              </View>
              {!isArchived ? (
                <Pressable
                  style={styles.removeButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    void handleRemoveMeeting(meeting.id);
                  }}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>

      {isEditOpen ? (
        <GroupFormSheet
          title="Editar grupo"
          initialName={group.name}
          onSave={handleRename}
          onClose={() => setIsEditOpen(false)}
        />
      ) : null}

      {isPickerOpen ? (
        <Modal visible animationType="slide" transparent onRequestClose={() => setIsPickerOpen(false)}>
          <View style={styles.backdrop}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Adicionar reunião</Text>
                <Pressable onPress={() => setIsPickerOpen(false)}>
                  <Text style={styles.backLink}>Fechar</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.pickerList}>
                {addableMeetings.length === 0 ? (
                  <Text style={styles.empty}>Nenhuma outra reunião disponível.</Text>
                ) : (
                  addableMeetings.map((meeting) => (
                    <Pressable
                      key={meeting.id}
                      style={styles.pickerOption}
                      onPress={() => void handleAddMeeting(meeting.id)}
                    >
                      <Text style={styles.pickerOptionText} numberOfLines={1}>
                        {meeting.title}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
    gap: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 4,
  },
  backLink: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.card2,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.secondaryForeground,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryForeground,
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
  error: {
    fontSize: 14,
    color: colors.destructive,
  },
  backButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
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
  meetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  meetingContent: {
    flex: 1,
    minWidth: 0,
  },
  meetingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  meetingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  meetingDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card2,
  },
  removeButtonText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  pickerList: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  pickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pickerOptionText: {
    fontSize: 15,
    color: colors.secondaryForeground,
  },
});
