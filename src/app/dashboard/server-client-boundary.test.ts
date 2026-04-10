import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function readSource(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("dashboard server/client boundaries", () => {
  it("keeps client modules isolated from server-only page helpers", async () => {
    const assertions: Array<[string, RegExp]> = [
      [
        "src/app/dashboard/dashboard-client.tsx",
        /from\s+["']\.\/dashboard-api["']/,
      ],
      [
        "src/app/dashboard/meetings/meetings-client.tsx",
        /from\s+["']\.\/meetings-api["']/,
      ],
      [
        "src/app/dashboard/meetings/[id]/meeting-detail-client.tsx",
        /from\s+["']\.\/meeting-api["']/,
      ],
      [
        "src/app/dashboard/meetings/[id]/edit/meeting-edit-client.tsx",
        /from\s+["']\.\/meeting-edit-api["']/,
      ],
    ];

    for (const [relativePath, importPattern] of assertions) {
      const source = await readSource(relativePath);
      expect(source).not.toMatch(importPattern);
    }
  });
});
