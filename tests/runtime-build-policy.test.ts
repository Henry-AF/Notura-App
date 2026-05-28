import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readText(path: string) {
  return readFileSync(path, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

describe("runtime and build policy", () => {
  it("pins the app to Node 24 LTS for local, CI, and Vercel builds", () => {
    const packageJson = readJson<{
      engines?: { node?: string };
    }>("package.json");
    const vercelJson = readJson<{
      build?: { env?: { NODE_VERSION?: string } };
    }>("vercel.json");
    const ci = readText(".github/workflows/ci.yml");

    expect(packageJson.engines?.node).toBe("24.x");
    expect(readText(".nvmrc").trim()).toBe("24");
    expect(readText(".node-version").trim()).toBe("24");
    expect(ci.match(/node-version:\s*24/g)).toHaveLength(2);
    expect(vercelJson.build?.env?.NODE_VERSION).toBe("24.x");
  });

  it("uses eslint directly because next lint is deprecated in Next 15", () => {
    const packageJson = readJson<{
      scripts?: { lint?: string; "lint:strict"?: string };
    }>("package.json");

    expect(packageJson.scripts?.lint).toBe("eslint --config .eslintrc.json .");
    expect(packageJson.scripts?.lint).not.toContain("next lint");
    expect(packageJson.scripts?.["lint:strict"]).toContain(
      "eslint --config .eslintrc.strict.cjs"
    );
  });
});
