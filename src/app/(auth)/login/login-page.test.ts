import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    resolve(process.cwd(), "src/app/(auth)/login/page.tsx"),
    "utf8"
  );
}

describe("login page navigation state", () => {
  it("keeps the submit button loading while the dashboard navigation is pending", () => {
    const source = readSource();

    expect(source).toContain('router.replace("/dashboard")');
    expect(source).not.toContain('router.push("/dashboard")');
    expect(source).not.toContain("finally {\n      setLoading(false);");
  });
});
