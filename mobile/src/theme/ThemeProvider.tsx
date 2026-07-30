import { createContext, useContext, useMemo, type ReactNode } from "react";
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

// The brand identity is a fixed dark/purple theme (see DESIGN.md) — it does
// not follow the device's system color scheme like a typical light/dark
// toggle would.
const mode: ThemeMode = "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: palette[mode],
      spacing,
      radius,
      typography: buildTypography(),
    }),
    []
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
