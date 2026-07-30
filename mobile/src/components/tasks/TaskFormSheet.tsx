import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "@/lib/theme/tokens";
import type { Task, TaskMeetingOption, TaskPriority, TaskStatus } from "@/lib/tasks/tasks-api";

const PRIORITIES: { id: TaskPriority; label: string; color: string }[] = [
  { id: "alta", label: "Alta", color: "#FF6B6B" },
  { id: "media", label: "Média", color: "#FFA94D" },
  { id: "baixa", label: "Baixa", color: "#4ECB71" },
];

const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "A Fazer" },
  { id: "in_progress", label: "Em Andamento" },
  { id: "completed", label: "Concluída" },
];

export interface TaskFormValues {
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  meetingId?: string;
  dueDate?: string;
  assigneeName?: string;
}

interface TaskFormSheetProps {
  task: Task | null;
  meetings: TaskMeetingOption[];
  onSave: (values: TaskFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function TaskFormSheet({ task, meetings, onSave, onDelete, onClose }: TaskFormSheetProps) {
  const isEditing = task !== null;
  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "media");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [meetingId, setMeetingId] = useState<string | undefined>(task?.meetingId ?? meetings[0]?.id);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assigneeName, setAssigneeName] = useState(task?.assigneeName ?? "");
  const [isMeetingPickerOpen, setIsMeetingPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMeetingLabel = meetings.find((m) => m.id === meetingId)?.label;
  const canSave = title.trim().length > 0 && (isEditing || Boolean(meetingId)) && !isSaving;

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        priority,
        status,
        meetingId,
        dueDate: dueDate.trim() || undefined,
        assigneeName: assigneeName.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar tarefa.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeletePress() {
    if (!onDelete) return;
    Alert.alert("Excluir tarefa", "Tem certeza que deseja excluir esta tarefa?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void onDelete() },
    ]);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isEditing ? "Editar tarefa" : "Nova tarefa"}</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Fechar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="O que precisa ser feito?"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.label}>Prioridade</Text>
            <View style={styles.pillRow}>
              {PRIORITIES.map((p) => {
                const active = priority === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.pill, active && { backgroundColor: `${p.color}26`, borderColor: p.color }]}
                    onPress={() => setPriority(p.id)}
                  >
                    <View style={[styles.pillDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.pillText, active && { color: p.color, fontWeight: "700" }]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Status</Text>
            <View style={styles.pillRow}>
              {STATUSES.map((s) => {
                const active = status === s.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setStatus(s.id)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Reunião de origem</Text>
            {isEditing ? (
              <Text style={styles.readonlyValue}>
                {task?.meetingSource ?? selectedMeetingLabel ?? "—"}
              </Text>
            ) : (
              <Pressable style={styles.input} onPress={() => setIsMeetingPickerOpen(true)}>
                <Text style={selectedMeetingLabel ? styles.inputText : styles.inputPlaceholder}>
                  {selectedMeetingLabel ?? "Selecionar reunião"}
                </Text>
              </Pressable>
            )}

            <Text style={styles.label}>Prazo (opcional)</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Responsável (opcional)</Text>
            <TextInput
              style={styles.input}
              value={assigneeName}
              onChangeText={setAssigneeName}
              placeholder="Nome"
              placeholderTextColor={colors.mutedForeground}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={() => void handleSave()}
              disabled={!canSave}
            >
              <Text style={styles.saveButtonText}>{isSaving ? "Salvando..." : "Salvar"}</Text>
            </Pressable>

            {onDelete ? (
              <Pressable style={styles.deleteButton} onPress={handleDeletePress}>
                <Text style={styles.deleteButtonText}>Excluir tarefa</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {isMeetingPickerOpen ? (
        <Modal visible animationType="slide" transparent onRequestClose={() => setIsMeetingPickerOpen(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Selecionar reunião</Text>
                <Pressable onPress={() => setIsMeetingPickerOpen(false)}>
                  <Text style={styles.close}>Fechar</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.form}>
                {meetings.length === 0 ? (
                  <Text style={styles.readonlyValue}>
                    Nenhuma reunião encontrada. Crie uma reunião antes de adicionar tarefas.
                  </Text>
                ) : (
                  meetings.map((meeting) => (
                    <Pressable
                      key={meeting.id}
                      style={[styles.option, meetingId === meeting.id && styles.optionSelected]}
                      onPress={() => {
                        setMeetingId(meeting.id);
                        setIsMeetingPickerOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          meetingId === meeting.id && styles.optionTextSelected,
                        ]}
                      >
                        {meeting.label}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  close: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 2,
  },
  input: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  inputText: {
    fontSize: 15,
    color: colors.foreground,
  },
  inputPlaceholder: {
    fontSize: 15,
    color: colors.mutedForeground,
  },
  readonlyValue: {
    fontSize: 14,
    color: colors.secondaryForeground,
    paddingVertical: 4,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: "rgba(139,122,255,0.15)",
    borderColor: colors.primary,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.secondaryForeground,
  },
  pillTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  error: {
    marginTop: 12,
    fontSize: 12,
    color: colors.destructive,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 15,
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    color: colors.destructive,
    fontWeight: "600",
    fontSize: 14,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionSelected: {
    backgroundColor: colors.card2,
  },
  optionText: {
    fontSize: 15,
    color: colors.secondaryForeground,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
});
