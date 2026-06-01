import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readText(path: string) {
  return readFileSync(path, "utf8");
}

describe("build warning policy", () => {
  it("does not load Google fonts through manual stylesheet links in the root layout", () => {
    const layout = readText("src/app/layout.tsx");

    expect(layout).not.toContain("fonts.googleapis.com");
    expect(layout).not.toContain('rel="stylesheet"');
  });

  it("renders the root theme script without raw HTML injection", () => {
    const layout = readText("src/app/layout.tsx");

    expect(layout).not.toContain("dangerouslySetInnerHTML");
    expect(layout).toContain("<script>{`");
    expect(layout).toContain("localStorage.getItem('notura-theme')");
  });

  it("sets the output tracing root explicitly for worktree builds", () => {
    const config = readText("next.config.mjs");

    expect(config).toContain("outputFileTracingRoot");
    expect(config).toContain("fileURLToPath");
  });

  it("keeps the Silk canvas setup effect independent from render props", () => {
    const silk = readText("src/components/ui/silk.tsx");

    expect(silk).not.toContain("uSpeed:        { value: speed }");
    expect(silk).not.toContain("uScale:        { value: scale }");
    expect(silk).not.toContain("uRotation:     { value: rotation }");
    expect(silk).not.toContain("uNoiseIntensity: { value: noiseIntensity }");
    expect(silk).toContain("[color, noiseIntensity, rotation, scale, speed]");
  });
});
