import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { TaskRow } from '@/components/tasks/TaskRow';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { fetchTaskBoard, updateTask, type Task, type TaskMeetingOption } from '@/lib/tasks/tasks-api';
import { STATUS_COLUMNS } from '@/lib/tasks/task-visuals';

type ViewMode = 'list' | 'kanban';

export default function TasksScreen() {
  const router = useRouter();
  const { colors, radius, spacing } = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<TaskMeetingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const board = await fetchTaskBoard();
      setTasks(board.tasks);
      setMeetings(board.meetings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function refresh() {
    setIsRefreshing(true);
    void load();
  }

  function openCreate() {
    setEditingTask(null);
    setIsFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setIsFormOpen(true);
  }

  function goToMeeting(meetingId: string) {
    router.push(`/(app)/meetings/${meetingId}`);
  }

  function handleCreated(task: Task) {
    setTasks((current) => [task, ...current]);
  }

  function handleUpdated(task: Task) {
    setTasks((current) => current.map((existing) => (existing.id === task.id ? task : existing)));
  }

  function handleDeleted(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  async function handleToggleDone(task: Task) {
    const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
    const previous = tasks;
    setTasks((current) =>
      current.map((existing) => (existing.id === task.id ? { ...existing, status: nextStatus } : existing))
    );
    try {
      const updated = await updateTask(task.id, { status: nextStatus });
      setTasks((current) => current.map((existing) => (existing.id === task.id ? updated : existing)));
    } catch {
      setTasks(previous);
    }
  }

  return (
    <Screen padded={false} style={styles.container}>
      <View style={[styles.toolbar, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
        <View style={[styles.toggle, { backgroundColor: colors.secondary, borderRadius: radius.full }]}>
          <ToggleButton label="Lista" icon="list-outline" active={viewMode === 'list'} onPress={() => setViewMode('list')} />
          <ToggleButton
            label="Kanban"
            icon="grid-outline"
            active={viewMode === 'kanban'}
            onPress={() => setViewMode('kanban')}
          />
        </View>

        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary, borderRadius: radius.full, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText variant="footnote" color={colors.error} style={styles.errorText}>
            {error}
          </ThemedText>
          <Pressable
            onPress={refresh}
            style={[styles.retryButton, { backgroundColor: colors.primary, borderRadius: radius.md }]}
          >
            <ThemedText variant="footnote" color={colors.primaryForeground}>
              Tentar novamente
            </ThemedText>
          </Pressable>
        </View>
      ) : viewMode === 'list' ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          {tasks.length === 0 ? (
            <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.empty}>
              Nenhuma tarefa ainda.
            </ThemedText>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onPress={openEdit}
                onMeetingPress={goToMeeting}
                onToggleDone={(t) => void handleToggleDone(t)}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          contentContainerStyle={[styles.kanbanContent, { paddingHorizontal: spacing.md }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
        >
          {STATUS_COLUMNS.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.id);
            return (
              <View key={column.id} style={styles.column}>
                <View style={styles.columnHeader}>
                  <View style={[styles.dot, { backgroundColor: column.dotColor }]} />
                  <ThemedText variant="footnote" color={colors.foreground} style={styles.columnTitle}>
                    {column.title}
                  </ThemedText>
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: column.badgeBg, borderRadius: radius.full },
                    ]}
                  >
                    <ThemedText variant="caption" color={column.badgeColor}>
                      {columnTasks.length}
                    </ThemedText>
                  </View>
                </View>

                <ScrollView contentContainerStyle={styles.columnList}>
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onPress={openEdit} onMeetingPress={goToMeeting} />
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      )}

      <TaskFormModal
        visible={isFormOpen}
        task={editingTask}
        meetings={meetings}
        onClose={() => setIsFormOpen(false)}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </Screen>
  );
}

function ToggleButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleButton,
        {
          borderRadius: radius.full,
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.md,
          backgroundColor: active ? colors.primary : 'transparent',
        },
      ]}
    >
      <Ionicons name={icon} size={14} color={active ? colors.primaryForeground : colors.mutedForeground} />
      <ThemedText variant="footnote" color={active ? colors.primaryForeground : colors.mutedForeground}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  toggle: {
    flexDirection: 'row',
    padding: 3,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listContent: {
    paddingBottom: 32,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  kanbanContent: {
    gap: 12,
    paddingBottom: 32,
  },
  column: {
    width: 240,
    gap: 8,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  columnTitle: {
    flex: 1,
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 20,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  columnList: {
    gap: 8,
  },
});
