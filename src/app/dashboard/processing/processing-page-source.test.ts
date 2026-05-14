import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProcessingPage(): string {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/processing/page.tsx"),
    "utf8"
  );
}

describe("processing page source", () => {
  it("drives the visible step from the backend processing step instead of fallback timers", () => {
    const source = readProcessingPage();

    expect(source).toContain("processingStep");
    expect(source).not.toContain("minMs");
    expect(source).not.toContain("setTimeout(() => {\n      setCurrentStep");
  });

  it("spins the progress ring around the svg center so the purple arc stays on the circle", () => {
    const source = readProcessingPage();

    expect(source).toContain('transformOrigin: "50% 50%"');
    expect(source).toContain('transformBox: "fill-box"');
    expect(source).not.toContain('className={done ? "transition-all duration-700" : "animate-spin"}');
  });
});
