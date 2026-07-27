/**
 * Font loading and family/weight resolution.
 *
 * Source of truth: web app uses Plus Jakarta Sans for headings and Inter for
 * body copy (see `src/app/layout.tsx` + `src/app/globals.css` at the repo
 * root). Fonts are loaded at runtime via `expo-font`'s `useFonts` hook, using
 * the official `@expo-google-fonts/*` packages instead of local `.ttf` files
 * (see https://docs.expo.dev/versions/v54.0.0/sdk/font/).
 */
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { fontSize } from "./tokens";

export type FontFamily = "display" | "body";
export type DisplayFontWeight = "400" | "500" | "600" | "700" | "800";
export type BodyFontWeight = "400" | "500" | "600";

export type TypographyDescriptor =
  | { family: "display"; weight: DisplayFontWeight; size: number; lineHeight: number }
  | { family: "body"; weight: BodyFontWeight; size: number; lineHeight: number };

export type TextVariant =
  | "display"
  | "title1"
  | "title2"
  | "headline"
  | "body"
  | "footnote"
  | "caption";

const DISPLAY_FONT_NAMES: Record<DisplayFontWeight, string> = {
  "400": "PlusJakartaSans_400Regular",
  "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold",
  "700": "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold",
};

const BODY_FONT_NAMES: Record<BodyFontWeight, string> = {
  "400": "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
};

/** Text-style scale for each semantic variant used by `ThemedText`. */
export const TEXT_VARIANTS: Record<TextVariant, TypographyDescriptor> = {
  display: { family: "display", weight: "800", size: fontSize.display, lineHeight: 52 },
  title1: { family: "display", weight: "700", size: fontSize.title1, lineHeight: 41 },
  title2: { family: "display", weight: "700", size: fontSize.title2, lineHeight: 34 },
  headline: { family: "body", weight: "600", size: fontSize.headline, lineHeight: 22 },
  body: { family: "body", weight: "400", size: fontSize.body, lineHeight: 24 },
  footnote: { family: "body", weight: "400", size: fontSize.footnote, lineHeight: 18 },
  caption: { family: "body", weight: "500", size: fontSize.caption, lineHeight: 14 },
};

/**
 * Resolves the loaded font name for a family/weight pair. Pure — safe to
 * unit test without loading any real fonts.
 */
export function resolveFontFamily(descriptor: TypographyDescriptor): string {
  if (descriptor.family === "display") {
    return DISPLAY_FONT_NAMES[descriptor.weight];
  }
  return BODY_FONT_NAMES[descriptor.weight];
}

export interface ResolvedTextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

/** Resolves a semantic text variant into a concrete RN text style. Pure. */
export function resolveTextVariantStyle(variant: TextVariant): ResolvedTextStyle {
  const descriptor = TEXT_VARIANTS[variant];
  return {
    fontFamily: resolveFontFamily(descriptor),
    fontSize: descriptor.size,
    lineHeight: descriptor.lineHeight,
  };
}

export interface AppFontsState {
  fontsLoaded: boolean;
  fontError: Error | null;
}

/** Loads the brand fonts (Plus Jakarta Sans + Inter) via `expo-font`. */
export function useAppFonts(): AppFontsState {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return { fontsLoaded, fontError };
}
