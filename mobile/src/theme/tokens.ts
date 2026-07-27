/**
 * Design tokens — mirrors the web app's source of truth exactly:
 * `tailwind.config.ts` + `src/app/globals.css` (root of the repo).
 *
 * This file is pure: no React Native or Expo imports. It must be safe to
 * import from a plain Node environment (e.g. unit tests, tooling scripts).
 */

export type ThemeMode = "light" | "dark";

export const palette = {
  light: {
    primary: "#6851FF",
    primaryLight: "#8B7AFF",
    primaryDark: "#5740EE",
    primaryForeground: "#FFFFFF",
    background: "#F5F4FC",
    foreground: "#0E0D14",
    card: "#FFFFFF",
    secondary: "#EEECFC",
    secondaryForeground: "#5A586E",
    muted: "#B9B6D2",
    mutedForeground: "#5A586E",
    border: "#D2CFEE",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    processing: "#E43790",
    shadow: "rgba(14, 13, 20, 0.08)",
  },
  dark: {
    primary: "#8B7AFF",
    primaryLight: "#8B7AFF",
    primaryDark: "#5740EE",
    primaryForeground: "#FFFFFF",
    background: "#0C0B0E",
    foreground: "#F4F4F6",
    card: "#1C1C1C",
    secondary: "#252230",
    secondaryForeground: "#9598A8",
    muted: "#3A3D4A",
    mutedForeground: "#9598A8",
    border: "#2C285B",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#FF6B6B",
    processing: "#E43790",
    shadow: "rgba(0, 0, 0, 0.4)",
  },
} as const;

export type Palette = (typeof palette)[ThemeMode];

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 24,
  "2xl": 32,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export const fontSize = {
  display: 44,
  title1: 34,
  title2: 28,
  headline: 17,
  body: 17,
  footnote: 13,
  caption: 11,
} as const;

/**
 * Resolves the color palette for a given theme mode. Pure — safe to unit test
 * without any React Native rendering.
 */
export function resolvePalette(mode: ThemeMode): Palette {
  return palette[mode];
}
