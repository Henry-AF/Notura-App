import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = join(__dirname, "..");

describe("instrumentation-client", () => {
  it("initializes Sentry and PostHog from the src instrumentation entrypoint", () => {
    const srcInstrumentation = readFileSync(
      join(projectRoot, "src/instrumentation-client.ts"),
      "utf8"
    );

    expect(srcInstrumentation).toContain('import * as Sentry from "@sentry/nextjs"');
    expect(srcInstrumentation).toContain('import posthog from "posthog-js"');
    expect(srcInstrumentation).toContain("Sentry.init(");
    expect(srcInstrumentation).toContain("posthog.init(");
    expect(existsSync(join(projectRoot, "instrumentation-client.ts"))).toBe(false);
  });
});
