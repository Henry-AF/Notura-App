import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runLint(target: string) {
  try {
    execFileSync("npm", ["run", "lint:strict", "--", target], {
      stdio: "pipe",
      encoding: "utf8",
    });

    return { status: 0, output: "" };
  } catch (error) {
    const failure = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };

    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

describe("lint enforcement", () => {
  it("accepts the compliant fixture under strict lint", () => {
    const result = runLint("tests/lint-fixtures/strict-pass.ts");

    expect(result.status).toBe(0);
  });

  it("rejects the violating fixture under strict lint", () => {
    const result = runLint("tests/lint-fixtures/strict-fail.ts");

    expect(result.status).not.toBe(0);
  });
});
