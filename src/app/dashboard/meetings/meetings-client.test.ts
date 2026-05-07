import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    resolve(process.cwd(), "src/app/dashboard/meetings/meetings-client.tsx"),
    "utf8"
  );
}

describe("meetings client presentation", () => {
  it("reuses the shared new meeting dropdown in the page header", () => {
    const source = readSource();

    expect(source).toContain("NewMeetingDropdown");
    expect(source).toContain("actions={");
    expect(source).toContain('router.push("/dashboard/recording")');
    expect(source).toContain('router.push("/dashboard/new")');
  });
});
