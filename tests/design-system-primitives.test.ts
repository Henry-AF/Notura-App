import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("design-system primitives", () => {
  it("uses semantic tokens in globals.css", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain("--background:");
    expect(css).toContain("--foreground:");
    expect(css).toContain("--card:");
    expect(css).toContain("--primary:");
    expect(css).toContain("--border:");
    expect(css).toContain("--ring:");
    expect(css).toContain("--destructive:");
  });

  it("exposes standardized button variants", () => {
    const button = read("src/components/ui/button.tsx");

    expect(button).toContain("outline");
    expect(button).toContain("destructive");
  });

  it("uses semantic color classes in core primitives", () => {
    const card = read("src/components/ui/card.tsx");
    const input = read("src/components/ui/input.tsx");
    const badge = read("src/components/ui/badge.tsx");
    const dropdown = read("src/components/ui/dropdown-menu.tsx");

    expect(card).toContain("bg-card");
    expect(card).toContain("text-card-foreground");
    expect(input).toContain("bg-background");
    expect(input).toContain("border-input");
    expect(badge).toContain("bg-muted");
    expect(dropdown).toContain("bg-popover");
    expect(dropdown).toContain("text-popover-foreground");
    expect(dropdown).not.toContain("bg-white");
  });

  it("uses pointer cursors for interactive dropdown items", () => {
    const dropdown = read("src/components/ui/dropdown-menu.tsx");

    expect(dropdown).toContain("cursor-pointer");
    expect(dropdown).not.toContain("cursor-default");
  });
});
