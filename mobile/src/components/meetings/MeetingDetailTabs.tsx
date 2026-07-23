import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
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
  return (
    <View>
      <Text style={styles.sectionTitle}>Ata / Resumo</Text>
      <Text style={styles.body}>{meeting.summary}</Text>
    </View>
  );
}

function TranscriptTab({ transcript }: { transcript: string | null }) {
  if (!transcript) {
    return <Text style={styles.empty}>Transcrição não disponível.</Text>;
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Transcrição</Text>
      <Text style={styles.transcript}>{transcript}</Text>
    </View>
  );
}

function ParticipantsTab({ meeting }: { meeting: MeetingDetail }) {
  const participants = meeting.participants;

  if (participants.length === 0) {
    return <Text style={styles.empty}>Nenhum participante identificado.</Text>;
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Participantes ({participants.length})</Text>
      {participants.map((participant) => (
        <View key={participant.id ?? participant.name} style={styles.listItem}>
          <Text style={styles.listItemText}>{participant.name}</Text>
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
  if (decisions.length === 0) {
    return <Text style={styles.empty}>Nenhuma decisão registrada.</Text>;
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Decisões ({decisions.length})</Text>
      {decisions.map((decision) => (
        <View key={decision.id} style={styles.listItem}>
          <Text style={styles.listItemText}>{decision.description}</Text>
          {decision.decidedBy ? (
            <Text style={styles.listItemMeta}>Por: {decision.decidedBy}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function TasksTab({ tasks }: { tasks: MeetingDetail["tasks"] }) {
  if (tasks.length === 0) {
    return <Text style={styles.empty}>Nenhuma tarefa extraída.</Text>;
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Tarefas ({tasks.length})</Text>
      {tasks.map((task) => (
        <View key={task.id} style={styles.listItem}>
          <Text style={[styles.listItemText, task.completed && styles.completed]}>
            {task.text}
          </Text>
          {task.assignee ? <Text style={styles.listItemMeta}>Responsável: {task.assignee}</Text> : null}
          {task.dueDate ? <Text style={styles.listItemMeta}>Prazo: {task.dueDate}</Text> : null}
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
    backgroundColor: "#f1f5f9",
  },
  tabActive: {
    backgroundColor: "#0f172a",
  },
  tabText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#fff",
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
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
  },
  transcript: {
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
    fontFamily: "monospace",
  },
  listItem: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 14,
    color: "#334155",
  },
  listItemMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  },
  completed: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  empty: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 24,
  },
});
