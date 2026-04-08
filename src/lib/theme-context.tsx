"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: true,
});

// ─── CSS helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a CSS color value that adapts to the current theme.
 * light value is used by default (no data-theme), dark when data-theme="dark".
 *
 * Components with inline styles should call useThemeColor() or just use the
 * pre-built THEME_COLORS map.
 */

// Pre-built palette so components don't need to call hooks and can reference
// static colour values based on the current theme prop.
export const DARK_COLORS = {
  bg: "#0C0B0E",
  bg2: "#141319",
  card: "#1C1C1C",
  card2: "#242424",
  inputBg: "#1E1E1E",
  inputBorder: "#3A3A3A",
  ink: "#F4F4F6",
  ink2: "#A0A0A0",
  ink3: "#606060",
  border: "#2E2E2E",
  border2: "#3A3A3A",
} as const;

export const LIGHT_COLORS = {
  bg: "#F5F4FC",
  bg2: "#FFFFFF",
  card: "#FFFFFF",
  card2: "#F8F7FE",
  inputBg: "#F8F7FE",
  inputBorder: "#D2CFEE",
  ink: "#0E0D14",
  ink2: "#46445A",
  ink3: "#8886A0",
  border: "#DCD9E8",
  border2: "#E4E1F4",
} as const;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Load saved preference and apply on mount
  useEffect(() => {
    const saved = (localStorage.getItem("notura-theme") as Theme | null) ?? "dark";
    applyTheme(saved);
    setThemeState(saved);
  }, []);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("notura-theme", t);
  };

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, isDark: theme === "dark" }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme() {
  return useContext(ThemeContext);
}

/** Returns the theme-aware color palette (DARK_COLORS or LIGHT_COLORS) */
export function useThemeColors() {
  const { isDark } = useTheme();
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}
