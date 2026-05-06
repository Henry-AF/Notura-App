import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionCard } from "./SubscriptionCard";

describe("SubscriptionCard", () => {
  it("shows the auto-renew control for paid plans", () => {
    const html = renderToStaticMarkup(
      <SubscriptionCard
        plan="pro"
        planName="Pro"
        meetingsUsed={12}
        meetingsTotal={30}
        renewsInDays={8}
        currentPeriodEnd="2026-05-27T12:00:00.000Z"
        autoRenewEnabled={true}
        renewalStatus="active"
        onAutoRenewChange={vi.fn()}
        onChangePlan={vi.fn()}
      />
    );

    expect(html).toContain("Renovação automática ativa");
    expect(html).toContain('aria-checked="true"');
  });
});
