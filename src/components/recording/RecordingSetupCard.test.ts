import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("RecordingSetupCard", () => {
  it("collects the recording mode with presencial and remota choices", () => {
    const source = readSource("src/components/recording/RecordingSetupCard.tsx");

    expect(source).toContain('export type RecordingMode = "in-person" | "remote";');
    expect(source).toContain("recordingMode: RecordingMode;");
    expect(source).toContain(
      'const [recordingMode, setRecordingMode] = useState<RecordingMode>("in-person");'
    );
    expect(source).toContain('<SelectItem value="in-person">Presencial</SelectItem>');
    expect(source).toContain('<SelectItem value="remote">Remota</SelectItem>');
    expect(source).toContain("recordingMode,");
  });
});
