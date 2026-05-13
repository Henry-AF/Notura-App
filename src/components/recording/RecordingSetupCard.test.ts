import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("RecordingSetupCard", () => {
  it("supports presencial, remota and upload choices", () => {
    const source = readSource("src/components/recording/RecordingSetupCard.tsx");
    const segmentedSource = readSource("src/components/ui/segmented-control.tsx");

    expect(source).toContain(
      'export type RecordingMode = "in-person" | "remote" | "upload";'
    );
    expect(source).toContain('{ value: "in-person", label: "Presencial"');
    expect(source).toContain('{ value: "remote", label: "Remota"');
    expect(source).toContain('{ value: "upload", label: "Upload"');
    expect(source).toContain("Data da reunião");
    expect(source).toContain("uploadField");
    expect(segmentedSource).toContain("grid-cols-3");
    expect(segmentedSource).toContain("flex-col");
  });

  it("defines an amber upload theme", () => {
    const source = readSource("src/components/recording/recording-theme.ts");

    expect(source).toContain("upload:");
    expect(source).toContain("amber");
  });
});
