import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readText(path: string) {
  return readFileSync(path, "utf8");
}

describe("PostHog identity policy", () => {
  it("does not use email as the auth distinct id or event property", () => {
    const login = readText("src/app/(auth)/login/page.tsx");
    const signup = readText("src/app/(auth)/signup/page.tsx");

    expect(login).not.toContain("posthog.identify(email");
    expect(signup).not.toContain("posthog.identify(email");
    expect(signup).not.toContain('email })');
    expect(signup).not.toContain('email, name');
  });

  it("does not use billing provider customer ids as PostHog distinct ids", () => {
    const stripeWebhook = readText("src/app/api/webhooks/stripe/route.ts");
    const abacatepayWebhook = readText("src/app/api/webhooks/abacatepay/route.ts");

    expect(stripeWebhook).not.toContain("distinctId: customerId");
    expect(abacatepayWebhook).not.toContain("distinctId: customerId");
  });
});
