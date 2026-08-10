import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const eslintPackageRoot = dirname(dirname(require.resolve("eslint")));
const eslintCliPath = join(eslintPackageRoot, "bin", "eslint.js");

function runLint(target: string) {
  try {
    execFileSync(process.execPath, [eslintCliPath, ...lintArgs(target)], {
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

function lintArgs(target: string): string[] {
  return [
    "--config",
    ".eslintrc.strict.cjs",
    "--max-warnings=0",
    "--no-error-on-unmatched-pattern",
    target,
  ];
}

describe("lint enforcement", () => {
  it("accepts the compliant fixture under strict lint", () => {
    const result = runLint("tests/lint-fixtures/strict-pass.ts");

    expect(result.status).toBe(0);
  }, 15_000);

  it("rejects the violating fixture under strict lint", () => {
    const result = runLint("tests/lint-fixtures/strict-fail.ts");

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("complexity");
  }, 15_000);
});
