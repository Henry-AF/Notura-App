import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { ThemedText } from '@/components/ui/ThemedText';
import type { Task } from '@/lib/tasks/tasks-api';
import { MEETING_LINK_COLOR, PRIORITY_VISUALS, formatDueDate } from '@/lib/tasks/task-visuals';

interface TaskCardProps {
  task: Task;
  onPress: (task: Task) => void;
  onMeetingPress: (meetingId: string) => void;
}

/** Kanban card — mirrors `src/components/tasks/TaskCard.tsx` on the web. */
export function TaskCard({ task, onPress, onMeetingPress }: TaskCardProps) {
  const { colors, radius, spacing } = useTheme();
  const isDone = task.status === 'completed';
  const priority = PRIORITY_VISUALS[task.priority];
  const dueLabel = task.completedDate ?? formatDueDate(task.dueDate);

  return (
    <Pressable
      onPress={() => onPress(task)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.sm + 4,
          opacity: isDone ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.priorityRow}>
        <View style={[styles.dot, { backgroundColor: priority.color }]} />
        <ThemedText variant="caption" color={priority.color} style={styles.priorityLabel}>
          {priority.label}
        </ThemedText>
      </View>

      <ThemedText
        variant="body"
        color={isDone ? colors.mutedForeground : colors.foreground}
        style={isDone ? styles.titleDone : undefined}
      >
        {task.title}
      </ThemedText>

      <View style={styles.footerRow}>
        {dueLabel ? (
          <View
            style={[
              styles.dueBadge,
              {
                borderRadius: radius.sm,
                backgroundColor: task.completedDate ? 'rgba(78,203,113,0.1)' : colors.secondary,
              },
            ]}
          >
            <ThemedText
              variant="caption"
              color={task.completedDate ? '#4ECB71' : colors.mutedForeground}
            >
              {dueLabel}
            </ThemedText>
          </View>
        ) : (
          <View />
        )}

        {task.generatedByAI && (
          <View style={[styles.dueBadge, { borderRadius: radius.sm, backgroundColor: 'rgba(108,92,231,0.1)' }]}>
            <ThemedText variant="caption" color="#6C5CE7">
              IA
            </ThemedText>
          </View>
        )}
      </View>

      {task.meetingSource && task.meetingId && !isDone && (
        <Pressable onPress={() => onMeetingPress(task.meetingId as string)} hitSlop={6}>
          <ThemedText variant="caption" color={MEETING_LINK_COLOR} numberOfLines={1} style={styles.meetingLink}>
            {task.meetingSource}
          </ThemedText>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    width: 220,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  titleDone: {
    textDecorationLine: 'line-through',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  meetingLink: {
    marginTop: 2,
  },
});
