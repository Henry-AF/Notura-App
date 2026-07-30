import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { ThemedText } from '@/components/ui/ThemedText';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  createTask,
  deleteTask,
  updateTask,
  type Task,
  type TaskMeetingOption,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/tasks/tasks-api';
import { PRIORITY_VISUALS, STATUS_COLUMNS } from '@/lib/tasks/task-visuals';

interface TaskFormModalProps {
  visible: boolean;
  task: Task | null;
  meetings: TaskMeetingOption[];
  onClose: () => void;
  onCreated: (task: Task) => void;
  onUpdated: (task: Task) => void;
  onDeleted: (id: string) => void;
}

const PRIORITIES: TaskPriority[] = ['baixa', 'media', 'alta'];

/** Create/edit sheet — status change lives here (tap → picker) since neither
 * mobile view supports drag-and-drop (NOT-150 UX decision). `meetingId` is
 * only editable at creation: the web's PATCH route never accepts it. */
export function TaskFormModal({
  visible,
  task,
  meetings,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: TaskFormModalProps) {
  const { colors, radius, spacing } = useTheme();
  const isEditing = task !== null;

  const [title, setTitle] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('media');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState('');
  const [owner, setOwner] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(task?.title ?? '');
    setMeetingId(task?.meetingId ?? meetings[0]?.id ?? '');
    setPriority(task?.priority ?? 'media');
    setStatus(task?.status ?? 'todo');
    setDueDate(task?.dueDate ?? '');
    setOwner(task?.ownerName ?? '');
    setError(null);
  }, [visible, task, meetings]);

  const canSave = title.trim().length > 0 && (isEditing || meetingId.length > 0) && !isSaving;

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      if (isEditing && task) {
        const updated = await updateTask(task.id, {
          title: title.trim(),
          priority,
          status,
          dueDate: dueDate.trim() || null,
          owner: owner.trim() || null,
        });
        onUpdated(updated);
      } else {
        const created = await createTask({
          title: title.trim(),
          meetingId,
          priority,
          status,
          dueDate: dueDate.trim() || undefined,
          owner: owner.trim() || undefined,
        });
        onCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tarefa.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
    if (!task) return;
    Alert.alert('Excluir tarefa', 'Tem certeza que quer excluir esta tarefa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task.id);
            onDeleted(task.id);
            onClose();
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao excluir tarefa.');
          }
        },
      },
    ]);
  }

  const meeting = meetings.find((m) => m.id === task?.meetingId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, padding: spacing.md }]}>
          <View style={styles.header}>
            <ThemedText variant="title2">{isEditing ? 'Editar tarefa' : 'Nova tarefa'}</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <ThemedText variant="body" color={colors.mutedForeground}>
                Fechar
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <ThemedText variant="footnote" color={colors.mutedForeground}>
              Título
            </ThemedText>
            <Input value={title} onChangeText={setTitle} placeholder="O que precisa ser feito?" />

            {isEditing ? (
              meeting && (
                <>
                  <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
                    Reunião de origem
                  </ThemedText>
                  <ThemedText variant="body">{meeting.clientName || meeting.title}</ThemedText>
                </>
              )
            ) : (
              <>
                <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
                  Reunião de origem
                </ThemedText>
                {meetings.length === 0 ? (
                  <ThemedText variant="footnote" color={colors.error}>
                    Você precisa ter ao menos uma reunião para criar uma tarefa.
                  </ThemedText>
                ) : (
                  <View style={styles.chipRow}>
                    {meetings.map((m) => {
                      const selected = meetingId === m.id;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => setMeetingId(m.id)}
                          style={[
                            styles.chip,
                            {
                              borderRadius: radius.full,
                              backgroundColor: selected ? colors.primary : colors.secondary,
                            },
                          ]}
                        >
                          <ThemedText
                            variant="caption"
                            color={selected ? colors.primaryForeground : colors.secondaryForeground}
                            numberOfLines={1}
                          >
                            {m.clientName || m.title}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
              Prioridade
            </ThemedText>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => {
                const selected = priority === p;
                const visual = PRIORITY_VISUALS[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.chip,
                      {
                        borderRadius: radius.full,
                        borderWidth: 1.5,
                        borderColor: visual.color,
                        backgroundColor: selected ? visual.color : 'transparent',
                      },
                    ]}
                  >
                    <ThemedText variant="caption" color={selected ? '#FFFFFF' : visual.color}>
                      {visual.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
              Status
            </ThemedText>
            <View style={styles.chipRow}>
              {STATUS_COLUMNS.map((column) => {
                const selected = status === column.id;
                return (
                  <Pressable
                    key={column.id}
                    onPress={() => setStatus(column.id)}
                    style={[
                      styles.chip,
                      {
                        borderRadius: radius.full,
                        borderWidth: 1.5,
                        borderColor: column.dotColor,
                        backgroundColor: selected ? column.dotColor : 'transparent',
                      },
                    ]}
                  >
                    <ThemedText variant="caption" color={selected ? '#FFFFFF' : column.dotColor}>
                      {column.title}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
              Prazo (AAAA-MM-DD)
            </ThemedText>
            <Input value={dueDate} onChangeText={setDueDate} placeholder="2026-08-15" autoCapitalize="none" />

            <ThemedText variant="footnote" color={colors.mutedForeground} style={styles.label}>
              Responsável
            </ThemedText>
            <Input value={owner} onChangeText={setOwner} placeholder="Nome (opcional)" />

            {error && (
              <ThemedText variant="footnote" color={colors.error} style={styles.label}>
                {error}
              </ThemedText>
            )}

            <View style={[styles.actions, { marginTop: spacing.md }]}>
              <Button
                label={isEditing ? 'Salvar' : 'Criar tarefa'}
                onPress={() => void handleSave()}
                disabled={!canSave}
                loading={isSaving}
                style={styles.saveButton}
              />
              {isEditing && <Button label="Excluir" variant="secondary" onPress={handleDelete} />}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  form: {
    gap: 6,
    paddingBottom: 24,
  },
  label: {
    marginTop: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actions: {
    gap: 10,
  },
  saveButton: {
    alignSelf: 'stretch',
  },
});
