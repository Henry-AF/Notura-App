import { Linking, Pressable, StyleSheet, View } from "react-native";
import { spacing } from "@/theme/tokens";
import { ThemedText } from "@/components/ui/ThemedText";
import { LEGAL_LINKS } from "@/lib/auth/auth-links";

const FOOTER_COLOR = "#3D3D3D";

/** "Termos de Uso · Privacidade" links, pinned to the bottom of the auth screens. */
export function AuthFooterLinks() {
  return (
    <View style={styles.row}>
      {LEGAL_LINKS.map((link) => (
        <Pressable
          key={link.label}
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => void Linking.openURL(link.url)}
        >
          <ThemedText variant="caption" color={FOOTER_COLOR}>
            {link.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: "auto",
    paddingTop: spacing.lg,
  },
});
