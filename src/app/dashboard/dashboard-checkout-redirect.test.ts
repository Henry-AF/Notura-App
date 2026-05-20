import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dashboard checkout redirect", () => {
  it("verifies payment redirects that land on the dashboard", () => {
    const source = readSource("src/app/dashboard/dashboard-client.tsx");

    expect(source).toContain('searchParams.get("payment")');
    expect(source).toContain('searchParams.get("session_id")');
    expect(source).toContain('fetch("/api/billing/checkout/verify"');
    expect(source).toContain('router.replace(pathname)');
    expect(source).toContain("router.refresh()");
  });
});
