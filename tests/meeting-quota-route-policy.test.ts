import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE_FILES = [
  "src/app/api/meetings/process/route.ts",
  "src/app/api/meetings/upload/route.ts",
];

function readRoute(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("meeting quota route policy", () => {
  it("does not keep legacy monthly-limit fallback after quotaStatus became required", () => {
    for (const routeFile of ROUTE_FILES) {
      const source = readRoute(routeFile);

      expect(source).not.toMatch(/!quotaStatus\s*&&/);
      expect(source).not.toMatch(/quotaStatus\s*&&/);
      expect(source).not.toContain("Você atingiu o limite mensal do seu plano");
      expect(source).not.toContain("Você atingiu o limite do plano Free");
    }
  });
});
