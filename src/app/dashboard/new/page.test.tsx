import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/new/page.tsx"),
    "utf8"
  );
}

describe("legacy new meeting page", () => {
  it("redirects to the upload mode inside recording", () => {
    const source = readSource();

    expect(source).toContain('redirect("/dashboard/recording?mode=upload")');
  });
});
