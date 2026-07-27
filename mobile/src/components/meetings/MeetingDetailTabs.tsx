import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
import type { MeetingDetail } from "@/lib/meetings/meeting-detail-api";

type DetailTab = "summary" | "transcript" | "participants" | "decisions" | "tasks";

interface MeetingDetailTabsProps {
  meeting: MeetingDetail;
}

const TABS: { key: DetailTab; label: string }[] = [
  { key: "summary", label: "Resumo" },
  { key: "transcript", label: "Transcrição" },
  { key: "participants", label: "Participantes" },
  { key: "decisions", label: "Decisões" },
  { key: "tasks", label: "Tarefas" },
];

export function MeetingDetailTabs({ meeting }: MeetingDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                { backgroundColor: isActive ? colors.primary : colors.secondary },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === "summary" ? <SummaryTab meeting={meeting} /> : null}
        {activeTab === "transcript" ? <TranscriptTab transcript={meeting.transcript} /> : null}
        {activeTab === "participants" ? <ParticipantsTab meeting={meeting} /> : null}
        {activeTab === "decisions" ? <DecisionsTab decisions={meeting.decisions} /> : null}
        {activeTab === "tasks" ? <TasksTab tasks={meeting.tasks} /> : null}
      </ScrollView>
    </View>
  );
}

function SummaryTab({ meeting }: { meeting: MeetingDetail }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ata / Resumo</Text>
      <Text style={[styles.body, { color: colors.foreground }]}>{meeting.summary}</Text>
    </View>
  );
}

function TranscriptTab({ transcript }: { transcript: string | null }) {
  const { colors } = useTheme();

  if (!transcript) {
    return (
      <Text style={[styles.empty, { color: colors.mutedForeground }]}>
        Transcrição não disponível.
      </Text>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Transcrição</Text>
      <Text style={[styles.transcript, { color: colors.foreground }]}>{transcript}</Text>
    </View>
  );
}

function ParticipantsTab({ meeting }: { meeting: MeetingDetail }) {
  const { colors } = useTheme();
  const participants = meeting.participants;

  if (participants.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.mutedForeground }]}>
        Nenhum participante identificado.
      </Text>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Participantes ({participants.length})
      </Text>
      {participants.map((participant) => (
        <View
          key={participant.id ?? participant.name}
          style={[styles.listItem, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.listItemText, { color: colors.foreground }]}>
            {participant.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DecisionsTab({
  decisions,
}: {
  decisions: MeetingDetail["decisions"];
}) {
  const { colors } = useTheme();

  if (decisions.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.mutedForeground }]}>
        Nenhuma decisão registrada.
      </Text>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Decisões ({decisions.length})
      </Text>
      {decisions.map((decision) => (
        <View key={decision.id} style={[styles.listItem, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.listItemText, { color: colors.foreground }]}>
            {decision.description}
          </Text>
          {decision.decidedBy ? (
            <Text style={[styles.listItemMeta, { color: colors.mutedForeground }]}>
              Por: {decision.decidedBy}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function TasksTab({ tasks }: { tasks: MeetingDetail["tasks"] }) {
  const { colors } = useTheme();

  if (tasks.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.mutedForeground }]}>
        Nenhuma tarefa extraída.
      </Text>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Tarefas ({tasks.length})
      </Text>
      {tasks.map((task) => (
        <View key={task.id} style={[styles.listItem, { backgroundColor: colors.secondary }]}>
          <Text
            style={[
              styles.listItemText,
              { color: task.completed ? colors.mutedForeground : colors.foreground },
              task.completed && styles.completed,
            ]}
          >
            {task.text}
          </Text>
          {task.assignee ? (
            <Text style={[styles.listItemMeta, { color: colors.mutedForeground }]}>
              Responsável: {task.assignee}
            </Text>
          ) : null}
          {task.dueDate ? (
            <Text style={[styles.listItemMeta, { color: colors.mutedForeground }]}>
              Prazo: {task.dueDate}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  transcript: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "monospace",
  },
  listItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 14,
  },
  listItemMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  completed: {
    textDecorationLine: "line-through",
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
  },
});
