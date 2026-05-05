import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readClientSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/ai-chats/ai-chats-client.tsx"),
    "utf8"
  );
}

describe("ai chats client presentation", () => {
  it("renders status labels without status icons", () => {
    const source = readClientSource();

    expect(source).not.toContain("<AlertCircle");
    expect(source).not.toContain("<Check");
    expect(source).not.toContain("<Bot");
  });

  it("uses native browser titles for truncated meeting filter labels", () => {
    const source = readClientSource();

    expect(source).toContain('title="Todas as reuniões"');
    expect(source).toContain("title={option.label}");
  });
});
