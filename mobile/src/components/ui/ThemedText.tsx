import { Text, type TextProps } from "react-native";
import { useTheme, type TextVariant } from "@/theme";

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
}

/** Text component with the app's typography scale (display/title1/title2/headline/body/footnote/caption). */
export function ThemedText({ variant = "body", color, style, children, ...rest }: ThemedTextProps) {
  const { colors, typography } = useTheme();
  const variantStyle = typography[variant];

  return (
    <Text
      style={[variantStyle, { color: color ?? colors.foreground }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}
