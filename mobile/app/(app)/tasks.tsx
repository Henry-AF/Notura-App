import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createTask,
  deleteTask,
  fetchTaskBoard,
  updateTask,
  type Task,
  type TaskMeetingOption,
  type TaskStatus,
} from "@/lib/tasks/tasks-api";
import { colors } from "@/lib/theme/tokens";
import { TaskListItem } from "@/components/tasks/TaskListItem";
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";
import { TaskFormSheet, type TaskFormValues } from "@/components/tasks/TaskFormSheet";

type ViewMode = "list" | "kanban";
type EditingTarget = Task | "new" | null;

function sortByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export default function TasksScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<TaskMeetingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const board = await fetchTaskBoard();
      setTasks(board.tasks);
      setMeetings(board.meetings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar tarefas.");
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

  const handleToggleDone = useCallback(async (task: Task) => {
    const nextStatus: TaskStatus = task.status === "completed" ? "todo" : "completed";
    setTasks((previous) =>
      previous.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
    try {
      await updateTask(task.id, { status: nextStatus });
    } catch {
      setTasks((previous) =>
        previous.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
      setError("Erro ao atualizar tarefa.");
    }
  }, []);

  const handleSave = useCallback(
    async (values: TaskFormValues) => {
      if (editingTarget === "new") {
        if (!values.meetingId) return;
        const created = await createTask({
          title: values.title,
          priority: values.priority,
          status: values.status,
          meetingId: values.meetingId,
          dueDate: values.dueDate,
          assigneeName: values.assigneeName,
        });
        setTasks((previous) => [created, ...previous]);
      } else if (editingTarget) {
        const updated = await updateTask(editingTarget.id, {
          title: values.title,
          priority: values.priority,
          status: values.status,
          dueDate: values.dueDate,
          assigneeName: values.assigneeName,
        });
        setTasks((previous) => previous.map((t) => (t.id === updated.id ? updated : t)));
      }
      setEditingTarget(null);
    },
    [editingTarget]
  );

  const handleDelete = useCallback(async () => {
    if (!editingTarget || editingTarget === "new") return;
    const id = editingTarget.id;
    setEditingTarget(null);
    setTasks((previous) => previous.filter((t) => t.id !== id));
    try {
      await deleteTask(id);
    } catch {
      setError("Erro ao excluir tarefa. Puxe para atualizar.");
    }
  }, [editingTarget]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const sortedTasks = sortByDueDate(tasks);
  const editingTask = editingTarget === "new" ? null : editingTarget;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tarefas</Text>
        <Pressable style={styles.addButton} onPress={() => setEditingTarget("new")}>
          <Text style={styles.addButtonText}>+ Nova tarefa</Text>
        </Pressable>
      </View>

      <View style={styles.toggleRow}>
        {(["list", "kanban"] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.toggleButton, viewMode === mode && styles.toggleButtonActive]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
              {mode === "list" ? "Lista" : "Kanban"}
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        {viewMode === "list" ? (
          <View style={styles.listContent}>
            {sortedTasks.length === 0 ? (
              <Text style={styles.empty}>Nenhuma tarefa ainda.</Text>
            ) : (
              sortedTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  onPress={() => setEditingTarget(task)}
                  onToggleDone={() => void handleToggleDone(task)}
                />
              ))
            )}
          </View>
        ) : (
          <TaskKanbanBoard tasks={tasks} onTaskPress={(task) => setEditingTarget(task)} />
        )}
      </ScrollView>

      {editingTarget ? (
        <TaskFormSheet
          task={editingTask}
          meetings={meetings}
          onSave={handleSave}
          onDelete={editingTask ? handleDelete : undefined}
          onClose={() => setEditingTarget(null)}
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  empty: {
    textAlign: "center",
    color: colors.mutedForeground,
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
