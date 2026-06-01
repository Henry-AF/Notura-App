import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AutoRenewControl } from "./AutoRenewControl";

describe("AutoRenewControl", () => {
  it("does not render for the free plan", () => {
    const html = renderToStaticMarkup(
      <AutoRenewControl
        plan="free"
        currentPeriodEnd={null}
        autoRenewEnabled={true}
        renewalStatus="idle"
        onChange={vi.fn()}
      />
    );

    expect(html).toBe("");
  });

  it("renders paid plan renewal status and switch state", () => {
    const html = renderToStaticMarkup(
      <AutoRenewControl
        plan="pro"
        currentPeriodEnd="2026-05-27T12:00:00.000Z"
        autoRenewEnabled={false}
        renewalStatus="active"
        subscriptionStatus="active"
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Renovação automática desativada");
    expect(html).toContain("Plano ativo até 27/05/2026");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="Ativar renovação automática"');
  });

  it("describes expired paid subscriptions as expired instead of upcoming renewals", () => {
    const html = renderToStaticMarkup(
      <AutoRenewControl
        plan="team"
        currentPeriodEnd="2026-05-29T12:00:00.000Z"
        autoRenewEnabled={true}
        renewalStatus="active"
        subscriptionStatus="expired"
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Assinatura vencida");
    expect(html).toContain("Assinatura vencida em 29/05/2026");
    expect(html).not.toContain("Próxima renovação em 29/05/2026");
    expect(html).toContain('aria-disabled="true"');
  });

  it("describes AbacatePay retry grace as renewal processing", () => {
    const html = renderToStaticMarkup(
      <AutoRenewControl
        plan="team"
        currentPeriodEnd="2026-05-29T12:00:00.000Z"
        autoRenewEnabled={true}
        renewalStatus="retrying"
        subscriptionStatus="grace"
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Renovação em processamento");
    expect(html).toContain("Estamos tentando renovar sua assinatura desde 29/05/2026.");
  });
});
