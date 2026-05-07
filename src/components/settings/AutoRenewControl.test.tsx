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
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("Renovação automática desativada");
    expect(html).toContain("Plano ativo até 27/05/2026");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="Ativar renovação automática"');
  });
});
