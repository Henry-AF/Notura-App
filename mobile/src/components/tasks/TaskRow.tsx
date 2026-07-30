import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { ThemedText } from '@/components/ui/ThemedText';
import type { Task } from '@/lib/tasks/tasks-api';
import { MEETING_LINK_COLOR, PRIORITY_VISUALS, formatDueDate } from '@/lib/tasks/task-visuals';

interface TaskRowProps {
  task: Task;
  onPress: (task: Task) => void;
  onMeetingPress: (meetingId: string) => void;
  onToggleDone: (task: Task) => void;
}

/** List row (mobile default view) — mirrors the web's `TaskRow` in `tasks-client.tsx`. */
export function TaskRow({ task, onPress, onMeetingPress, onToggleDone }: TaskRowProps) {
  const { colors, radius, spacing } = useTheme();
  const isDone = task.status === 'completed';
  const priority = PRIORITY_VISUALS[task.priority];
  const dueLabel = formatDueDate(task.dueDate);

  return (
    <Pressable
      onPress={() => onPress(task)}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          backgroundColor: pressed ? colors.secondary : 'transparent',
        },
      ]}
    >
      <Pressable onPress={() => onToggleDone(task)} hitSlop={10} style={styles.checkbox}>
        <View
          style={[
            styles.checkboxBox,
            {
              borderRadius: radius.sm - 4,
              borderColor: isDone ? '#4ECB71' : colors.border,
              backgroundColor: isDone ? '#4ECB71' : 'transparent',
            },
          ]}
        >
          {isDone && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
        </View>
      </Pressable>

      <View style={styles.mainColumn}>
        <ThemedText
          variant="body"
          color={isDone ? colors.mutedForeground : colors.foreground}
          numberOfLines={2}
          style={isDone ? styles.titleDone : undefined}
        >
          {task.title}
        </ThemedText>

        <View style={styles.metaRow}>
          <View style={[styles.dot, { backgroundColor: priority.color }]} />
          {dueLabel && (
            <ThemedText variant="caption" color={colors.mutedForeground}>
              {dueLabel}
            </ThemedText>
          )}
          {task.ownerName && (
            <ThemedText variant="caption" color={colors.mutedForeground} numberOfLines={1}>
              · {task.ownerName}
            </ThemedText>
          )}
        </View>

        {task.meetingSource && task.meetingId && (
          <Pressable onPress={() => onMeetingPress(task.meetingId as string)} hitSlop={6}>
            <View
              style={[
                styles.meetingPill,
                { borderRadius: radius.sm, backgroundColor: 'rgba(108,92,231,0.12)' },
              ]}
            >
              <ThemedText variant="caption" color={MEETING_LINK_COLOR} numberOfLines={1}>
                {task.meetingSource}
              </ThemedText>
            </View>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    paddingTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainColumn: {
    flex: 1,
    gap: 4,
  },
  titleDone: {
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  meetingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
});
