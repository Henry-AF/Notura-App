import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("BannerCarousel", () => {
  it("uses the same surface shadow as SectionCard", () => {
    const source = readSource("src/components/dashboard/BannerCarousel.tsx");

    expect(source).toContain("shadow-[0_2px_8px_rgba(0,0,0,0.06)]");
  });
});
