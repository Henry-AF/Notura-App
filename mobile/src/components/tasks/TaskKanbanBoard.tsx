import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme/tokens";
import type { Task, TaskStatus } from "@/lib/tasks/tasks-api";

// Mirrors `COLUMN_DEFS` in the web app's `src/lib/tasks/board.ts`.
// No drag-and-drop here — per the NOT-150 UX decision, status changes go
// through the edit sheet's status selector, not through dragging cards
// between columns (fragile on touch).
const COLUMNS: { id: TaskStatus; title: string; dotColor: string }[] = [
  { id: "todo", title: "A Fazer", dotColor: "#8B7AFF" },
  { id: "in_progress", title: "Em Andamento", dotColor: "#FFA94D" },
  { id: "completed", title: "Concluído", dotColor: "#4ECB71" },
];

interface TaskKanbanBoardProps {
  tasks: Task[];
  onTaskPress: (task: Task) => void;
}

export function TaskKanbanBoard({ tasks, onTaskPress }: TaskKanbanBoardProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);
        return (
          <View key={column.id} style={styles.column}>
            <View style={styles.columnHeader}>
              <View style={[styles.columnDot, { backgroundColor: column.dotColor }]} />
              <Text style={styles.columnTitle}>{column.title}</Text>
              <Text style={styles.columnCount}>{columnTasks.length}</Text>
            </View>

            {columnTasks.length === 0 ? (
              <Text style={styles.columnEmpty}>Sem tarefas.</Text>
            ) : (
              columnTasks.map((task) => (
                <Pressable key={task.id} style={styles.card} onPress={() => onTaskPress(task)}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                  {task.meetingSource ? (
                    <Text style={styles.cardMeeting} numberOfLines={1}>
                      {task.meetingSource}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  board: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 8,
  },
  column: {
    width: 240,
    gap: 8,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  columnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
    flex: 1,
  },
  columnCount: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  columnEmpty: {
    fontSize: 12,
    color: colors.mutedForeground,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  cardMeeting: {
    fontSize: 11,
    color: colors.primary,
  },
});
