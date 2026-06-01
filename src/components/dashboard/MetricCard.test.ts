import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(): string {
  return readFileSync(resolve(process.cwd(), "src/components/dashboard/MetricCard.tsx"), "utf8");
}

describe("MetricCard hooks", () => {
  it("calls useCountUp unconditionally before deriving the displayed value", () => {
    const source = readSource();
    const countUpCallIndex = source.indexOf("const animatedValue = useCountUp(numericValue);");
    const displayValueIndex = source.indexOf("const displayValue =");

    expect(source).not.toContain("react-hooks/rules-of-hooks");
    expect(countUpCallIndex).toBeGreaterThan(-1);
    expect(displayValueIndex).toBeGreaterThan(countUpCallIndex);
  });
});
