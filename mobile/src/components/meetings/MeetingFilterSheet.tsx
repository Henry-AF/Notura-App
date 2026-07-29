import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
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
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Filtrar por grupo</Text>
            <Pressable onPress={onClose}>
              <Text style={[styles.close, { color: colors.mutedForeground }]}>Fechar</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.option, selectedGroupId === null && { backgroundColor: colors.secondary }]}
            onPress={() => {
              onSelectGroup(null);
              onClose();
            }}
          >
            <Text
              style={[
                styles.optionText,
                { color: selectedGroupId === null ? colors.primary : colors.foreground },
                selectedGroupId === null && styles.optionTextSelected,
              ]}
            >
              Todos os grupos
            </Text>
          </Pressable>

          {groups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            return (
              <Pressable
                key={group.id}
                style={[styles.option, isSelected && { backgroundColor: colors.secondary }]}
                onPress={() => {
                  onSelectGroup(group.id);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: isSelected ? colors.primary : colors.foreground },
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {group.name}
                </Text>
                <Text style={[styles.count, { color: colors.mutedForeground }]}>
                  {group.meetingsCount}
                </Text>
              </Pressable>
            );
          })}
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
  },
  close: {
    fontSize: 14,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionText: {
    fontSize: 15,
  },
  optionTextSelected: {
    fontWeight: "600",
  },
  count: {
    fontSize: 13,
  },
});
