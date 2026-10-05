import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { palette, radius, spacing } from "@/theme/tokens";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";

const colors = palette.light;
const TEXT_DARK = "#3D3D3D";
const GOOGLE_BLUE = "#4285F4";

interface PrimaryActionProps {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** Full-width purple CTA with a soft purple shadow. */
export function PrimaryAction({ label, loading, disabled, onPress }: PrimaryActionProps) {
  return (
    <Button
      label={label}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      style={styles.primary}
    />
  );
}

/** "──── ou ────" divider. */
export function OrDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <ThemedText variant="footnote" color={colors.mutedForeground}>
        ou
      </ThemedText>
      <View style={styles.dividerLine} />
    </View>
  );
}

/** Outlined "Continue com o Google" button. */
export function GoogleButton(props: Omit<PressableProps, "children" | "style">) {
  return (
    <Pressable accessibilityRole="button" style={styles.google} {...props}>
      <ThemedText variant="headline" color={GOOGLE_BLUE} style={styles.googleG}>
        G
      </ThemedText>
      <ThemedText variant="headline" color={TEXT_DARK} style={styles.googleLabel}>
        Continue com o Google
      </ThemedText>
    </Pressable>
  );
}

interface TextLinkRowProps {
  prefix: string;
  action: string;
  onPress: () => void;
}

/** "Novo por aqui? Crie um **Cadastro**" — the pressable part is the bold purple action. */
export function TextLinkRow({ prefix, action, onPress }: TextLinkRowProps) {
  return (
    <ThemedText variant="footnote" color={TEXT_DARK} style={styles.linkRow}>
      {prefix}
      <ThemedText
        variant="footnote"
        color={colors.primary}
        style={styles.linkAction}
        accessibilityRole="link"
        onPress={onPress}
      >
        {action}
      </ThemedText>
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 48,
    paddingVertical: 0,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E4E2F0" },
  google: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#E4E2F0",
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },
  googleG: { fontSize: 20, fontWeight: "700" },
  googleLabel: { fontSize: 15 },
  linkRow: { textAlign: "center", marginTop: spacing.lg },
  linkAction: { fontWeight: "700" },
});
