import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme/tokens";
import type { MeetingTemplateOption } from "@/lib/meetings/export-ata";

interface TemplatePickerSheetProps {
  templates: MeetingTemplateOption[];
  onSelect: (templateId: string) => void;
  onClose: () => void;
}

// Read-only picker (NOT-158): choose which already-registered template to
// export the ata with. Uploading a new custom template stays web-only.
export function TemplatePickerSheet({ templates, onSelect, onClose }: TemplatePickerSheetProps) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Exportar ata com qual modelo?</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Fechar</Text>
            </Pressable>
          </View>

          {templates.map((template) => (
            <Pressable
              key={template.id}
              style={styles.option}
              onPress={() => onSelect(template.id)}
            >
              <Text style={styles.optionText}>{template.name}</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
    flex: 1,
    marginRight: 12,
  },
  close: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionText: {
    fontSize: 15,
    color: colors.secondaryForeground,
  },
});
