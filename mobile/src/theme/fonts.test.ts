import { resolveFontFamily, resolveTextVariantStyle, TEXT_VARIANTS } from "./fonts";
import { fontSize } from "./tokens";

describe("resolveFontFamily", () => {
  it("resolves display family weights to Plus Jakarta Sans font names", () => {
    expect(resolveFontFamily({ family: "display", weight: "400", size: 0, lineHeight: 0 })).toBe(
      "PlusJakartaSans_400Regular"
    );
    expect(resolveFontFamily({ family: "display", weight: "700", size: 0, lineHeight: 0 })).toBe(
      "PlusJakartaSans_700Bold"
    );
    expect(resolveFontFamily({ family: "display", weight: "800", size: 0, lineHeight: 0 })).toBe(
      "PlusJakartaSans_800ExtraBold"
    );
  });

  it("resolves body family weights to Inter font names", () => {
    expect(resolveFontFamily({ family: "body", weight: "400", size: 0, lineHeight: 0 })).toBe(
      "Inter_400Regular"
    );
    expect(resolveFontFamily({ family: "body", weight: "600", size: 0, lineHeight: 0 })).toBe(
      "Inter_600SemiBold"
    );
  });
});

describe("resolveTextVariantStyle", () => {
  it("resolves the 'display' variant to the display font size and family", () => {
    const style = resolveTextVariantStyle("display");
    expect(style.fontSize).toBe(fontSize.display);
    expect(style.fontFamily).toBe("PlusJakartaSans_800ExtraBold");
  });

  it("resolves the 'body' variant to the Inter regular font", () => {
    const style = resolveTextVariantStyle("body");
    expect(style.fontSize).toBe(fontSize.body);
    expect(style.fontFamily).toBe("Inter_400Regular");
  });

  it("resolves the 'headline' variant to a semibold Inter font", () => {
    const style = resolveTextVariantStyle("headline");
    expect(style.fontFamily).toBe("Inter_600SemiBold");
  });

  it("covers every declared text variant", () => {
    const variants = Object.keys(TEXT_VARIANTS);
    for (const variant of variants) {
      expect(() => resolveTextVariantStyle(variant as keyof typeof TEXT_VARIANTS)).not.toThrow();
    }
  });
});
