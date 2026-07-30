import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

interface ScreenProps {
  children: ReactNode;
  edges?: Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** SafeAreaView themed with the app's background color and default padding. */
export function Screen({ children, edges, padded = true, style }: ScreenProps) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.base,
        {
          backgroundColor: colors.background,
          padding: padded ? spacing.md : 0,
        },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
