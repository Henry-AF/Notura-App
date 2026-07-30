import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MeetingDetail } from "@/lib/meetings/meeting-detail-api";
import { colors } from "@/lib/theme/tokens";

type DetailTab =
  | "summary"
  | "transcript"
  | "participants"
  | "decisions"
  | "tasks"
  | "pending";

interface MeetingDetailTabsProps {
  meeting: MeetingDetail;
}

const TABS: { key: DetailTab; label: string }[] = [
  { key: "summary", label: "Resumo" },
  { key: "transcript", label: "Transcrição" },
  { key: "participants", label: "Participantes" },
  { key: "decisions", label: "Decisões" },
  { key: "tasks", label: "Tarefas" },
  { key: "pending", label: "Pendências" },
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
        {activeTab === "pending" ? <PendingTab openItems={meeting.openItems} /> : null}
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

function PendingTab({ openItems }: { openItems: MeetingDetail["openItems"] }) {
  if (openItems.length === 0) {
    return <Text style={styles.empty}>Nenhuma pendência registrada.</Text>;
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Pendências ({openItems.length})</Text>
      {openItems.map((item) => (
        <View key={item.id} style={[styles.listItem, styles.pendingItem]}>
          <Text style={styles.listItemText}>{item.description}</Text>
          {item.context ? (
            <Text style={styles.pendingItemMeta}>{item.context}</Text>
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
    backgroundColor: colors.card2,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.primaryForeground,
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
    color: colors.foreground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.secondaryForeground,
  },
  transcript: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.secondaryForeground,
    fontFamily: "monospace",
  },
  listItem: {
    backgroundColor: colors.card2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 14,
    color: colors.secondaryForeground,
  },
  listItemMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  pendingItem: {
    backgroundColor: "rgba(255,169,77,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,169,77,0.2)",
  },
  pendingItemMeta: {
    fontSize: 12,
    color: "#FFA94D",
    marginTop: 4,
  },
  completed: {
    textDecorationLine: "line-through",
    color: colors.mutedForeground,
  },
  empty: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 24,
  },
});
