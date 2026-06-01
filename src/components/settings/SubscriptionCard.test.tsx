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
        subscriptionStatus="active"
        onAutoRenewChange={vi.fn()}
        onChangePlan={vi.fn()}
      />
    );

    expect(html).toContain("Renovação automática ativa");
    expect(html).toContain('aria-checked="true"');
  });

  it("shows an expired subscription footer when the paid entitlement is expired", () => {
    const html = renderToStaticMarkup(
      <SubscriptionCard
        plan="team"
        planName="Pro"
        meetingsUsed={12}
        meetingsTotal={100}
        renewsInDays={8}
        currentPeriodEnd="2026-05-29T12:00:00.000Z"
        autoRenewEnabled={true}
        renewalStatus="active"
        subscriptionStatus="expired"
        onAutoRenewChange={vi.fn()}
        onChangePlan={vi.fn()}
      />
    );

    expect(html).toContain("Assinatura vencida");
    expect(html).toContain("Assinatura vencida em 29/05/2026");
    expect(html).not.toContain("Renova em 8 dias");
  });
});
