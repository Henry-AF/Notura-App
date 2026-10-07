import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { palette, spacing } from "@/theme/tokens";
import { ThemedText } from "@/components/ui/ThemedText";
import { AuthLogo } from "./AuthLogo";
import { AuthFooterLinks } from "./AuthFooterLinks";

/** Auth screens always render on the light brand surface, whatever the app theme is. */
export const authColors = palette.light;

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Shared shell for Login and Sign Up: gradient, back button, logo, heading and legal footer. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <LinearGradient colors={[authColors.background, "#FBFAFF"]} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <BackButton />
            <AuthLogo />
            <ThemedText variant="title2" color={TITLE_COLOR} style={styles.title}>
              {title}
            </ThemedText>
            <ThemedText variant="body" color={authColors.mutedForeground} style={styles.subtitle}>
              {subtitle}
            </ThemedText>
            {children}
            <AuthFooterLinks />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function BackButton() {
  const router = useRouter();
  if (!router.canGoBack()) {
    return <View style={styles.backSpacer} />;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={12}
      onPress={() => router.back()}
      style={styles.back}
    >
      <Ionicons name="chevron-back" size={26} color={TITLE_COLOR} />
    </Pressable>
  );
}

const TITLE_COLOR = "#3D3D3D";

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  back: { alignSelf: "flex-start", paddingVertical: spacing.sm },
  backSpacer: { height: 26 + spacing.sm * 2 },
  title: { marginTop: spacing.lg, textAlign: "center", fontSize: 24, lineHeight: 30 },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
});
