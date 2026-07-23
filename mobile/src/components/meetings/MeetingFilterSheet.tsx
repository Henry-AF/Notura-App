import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { MeetingGroup } from "@/lib/meetings/groups-api";

interface MeetingFilterSheetProps {
  visible: boolean;
  groups: MeetingGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onClose: () => void;
}

export function MeetingFilterSheet({
  visible,
  groups,
  selectedGroupId,
  onSelectGroup,
  onClose,
}: MeetingFilterSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filtrar por grupo</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Fechar</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.option, selectedGroupId === null && styles.optionSelected]}
            onPress={() => {
              onSelectGroup(null);
              onClose();
            }}
          >
            <Text style={[styles.optionText, selectedGroupId === null && styles.optionTextSelected]}>
              Todos os grupos
            </Text>
          </Pressable>

          {groups.map((group) => (
            <Pressable
              key={group.id}
              style={[styles.option, selectedGroupId === group.id && styles.optionSelected]}
              onPress={() => {
                onSelectGroup(group.id);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedGroupId === group.id && styles.optionTextSelected,
                ]}
              >
                {group.name}
              </Text>
              <Text style={styles.count}>{group.meetingsCount}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  close: {
    fontSize: 14,
    color: "#64748b",
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionSelected: {
    backgroundColor: "#eff6ff",
  },
  optionText: {
    fontSize: 15,
    color: "#334155",
  },
  optionTextSelected: {
    color: "#2563eb",
    fontWeight: "600",
  },
  count: {
    fontSize: 13,
    color: "#94a3b8",
  },
});
