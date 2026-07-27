import { palette, resolvePalette } from "./tokens";

describe("resolvePalette", () => {
  it("returns the light palette for mode 'light'", () => {
    expect(resolvePalette("light")).toBe(palette.light);
  });

  it("returns the dark palette for mode 'dark'", () => {
    expect(resolvePalette("dark")).toBe(palette.dark);
  });

  it("uses the brand primary color from the web design system in light mode", () => {
    expect(resolvePalette("light").primary).toBe("#6851FF");
  });

  it("uses the adaptive primary color in dark mode", () => {
    expect(resolvePalette("dark").primary).toBe("#8B7AFF");
  });
});
