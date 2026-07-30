import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/theme";
import { ThemedText } from "./ThemedText";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  ...rest
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;
  const { backgroundColor, textColor } = resolveButtonColors(variant, colors);

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderRadius: radius.md,
          paddingVertical: spacing.md - spacing.xs / 2,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText variant="headline" color={textColor}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

function resolveButtonColors(
  variant: ButtonVariant,
  colors: ReturnType<typeof useTheme>["colors"]
): { backgroundColor: string; textColor: string } {
  if (variant === "primary") {
    return { backgroundColor: colors.primary, textColor: colors.primaryForeground };
  }
  if (variant === "secondary") {
    return { backgroundColor: colors.secondary, textColor: colors.secondaryForeground };
  }
  return { backgroundColor: "transparent", textColor: colors.primary };
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
});
