import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PRIVATE_ROUTES_REQUIRING_WITH_AUTH = [
  "src/app/api/dashboard/overview/route.ts",
  "src/app/api/user/me/route.ts",
  "src/app/api/user/account/route.ts",
  "src/app/api/tasks/route.ts",
  "src/app/api/tasks/[id]/route.ts",
  "src/app/api/assemblyai/token/route.ts",
  "src/app/api/stripe/checkout/route.ts",
  "src/app/api/stripe/checkout/verify/route.ts",
  "src/app/api/abacatepay/customer/ensure/route.ts",
  "src/app/api/abacatepay/checkout/route.ts",
  "src/app/api/abacatepay/checkout/verify/route.ts",
  "src/app/api/meetings/route.ts",
  "src/app/api/meetings/process/route.ts",
  "src/app/api/meetings/upload/route.ts",
  "src/app/api/meetings/[id]/route.ts",
  "src/app/api/meetings/[id]/status/route.ts",
  "src/app/api/meetings/[id]/retry/route.ts",
  "src/app/api/meetings/[id]/resend/route.ts",
  "src/app/api/meetings/[id]/export/route.ts",
];

const ID_ROUTES_REQUIRING_OWNERSHIP = [
  "src/app/api/tasks/[id]/route.ts",
  "src/app/api/meetings/[id]/status/route.ts",
  "src/app/api/meetings/[id]/retry/route.ts",
  "src/app/api/meetings/[id]/resend/route.ts",
  "src/app/api/meetings/[id]/export/route.ts",
];

const PUBLIC_ROUTES = [
  "src/app/api/inngest/route.ts",
  "src/app/api/webhooks/abacatepay/route.ts",
  "src/app/api/webhooks/assemblyai/route.ts",
  "src/app/api/webhooks/stripe/route.ts",
];

function readRouteFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("API auth policy", () => {
  it("wraps every private API route with withAuth", () => {
    for (const routePath of PRIVATE_ROUTES_REQUIRING_WITH_AUTH) {
      const source = readRouteFile(routePath);
      expect(source).toContain("= withAuth");
    }
  });

  it("enforces requireOwnership in private :id routes that mutate or expose owned resources", () => {
    for (const routePath of ID_ROUTES_REQUIRING_OWNERSHIP) {
      const source = readRouteFile(routePath);
      expect(source).toContain("requireOwnership(");
    }
  });

  it("keeps public integration routes outside of withAuth", () => {
    for (const routePath of PUBLIC_ROUTES) {
      const source = readRouteFile(routePath);
      expect(source).not.toContain("= withAuth");
    }
  });
});
