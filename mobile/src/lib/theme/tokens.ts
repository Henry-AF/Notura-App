// Dark theme palette ported from the web app's `src/app/globals.css`
// (`html[data-theme="dark"]` block) — no shared module boundary between the
// Next.js app and this Expo package, so the RGB values are duplicated here.
// Scope: used by the Home/Dashboard screen (NOT-145) only, not yet applied
// app-wide to the rest of the mobile screens.

export const colors = {
  background: "rgb(12, 11, 14)",
  foreground: "rgb(244, 244, 246)",

  card: "rgb(28, 28, 28)",
  card2: "rgb(36, 36, 36)",
  cardForeground: "rgb(244, 244, 246)",

  popover: "rgb(20, 19, 25)",

  primary: "rgb(139, 122, 255)",
  primaryForeground: "#ffffff",

  secondary: "rgb(37, 34, 48)",
  secondaryForeground: "rgb(149, 152, 168)",

  muted: "rgb(58, 61, 74)",
  mutedForeground: "rgb(149, 152, 168)",

  border: "rgb(44, 40, 91)",
  destructive: "rgb(255, 107, 107)",
} as const;

export const statusColors = {
  completed: { text: "#4ECB71", background: "rgba(78, 203, 113, 0.12)" },
  processing: { text: "#74C0FC", background: "rgba(116, 192, 252, 0.12)" },
  failed: { text: "#FF6B6B", background: "rgba(255, 107, 107, 0.12)" },
} as const;
