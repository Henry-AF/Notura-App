import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("SettingsModal", () => {
  it("keeps a stable desktop frame across tabs", () => {
    const source = readSource("src/components/settings/SettingsModal.tsx");

    expect(source).toContain('const modalFrameMinHeight = "min(560px, 90dvh)";');
    expect(source).toContain("minHeight: modalFrameMinHeight");
  });
});
