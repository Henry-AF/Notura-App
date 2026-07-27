import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { palette, radius, spacing, type Palette, type ThemeMode } from "./tokens";
import { resolveTextVariantStyle, type ResolvedTextStyle, type TextVariant } from "./fonts";

const TEXT_VARIANT_NAMES: TextVariant[] = [
  "display",
  "title1",
  "title2",
  "headline",
  "body",
  "footnote",
  "caption",
];

export interface ThemeContextValue {
  mode: ThemeMode;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: Record<TextVariant, ResolvedTextStyle>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTypography(): Record<TextVariant, ResolvedTextStyle> {
  const entries = TEXT_VARIANT_NAMES.map(
    (variant) => [variant, resolveTextVariantStyle(variant)] as const
  );
  return Object.fromEntries(entries) as Record<TextVariant, ResolvedTextStyle>;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const mode: ThemeMode = systemScheme === "dark" ? "dark" : "light";

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: palette[mode],
      spacing,
      radius,
      typography: buildTypography(),
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
