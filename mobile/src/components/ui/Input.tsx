import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { useTheme } from "@/theme";

type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
type BlurHandler = NonNullable<TextInputProps["onBlur"]>;

/** TextInput themed with the app's secondary surface, radius, and focus state. */
export function Input({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const { colors, radius, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus: FocusHandler = (event) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur: BlurHandler = (event) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[
        styles.base,
        {
          backgroundColor: colors.secondary,
          borderRadius: radius.md,
          borderColor: isFocused ? colors.primary : colors.border,
          color: colors.foreground,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    paddingVertical: 12,
    fontSize: 17,
  },
});
