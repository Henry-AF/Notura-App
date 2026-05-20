import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SidebarPlanWidget } from "./SidebarPlanWidget";

describe("SidebarPlanWidget", () => {
  it("opens the plan modal from the top paid plan without unlimited copy", () => {
    const html = renderToStaticMarkup(
      <SidebarPlanWidget
        planName="Pro"
        used={12}
        total={100}
        onUpgradeClick={vi.fn()}
      />
    );

    expect(html).toContain("Ver planos");
    expect(html).not.toContain("ilimitado");
    expect(html).toContain("12 reuniões usadas neste mês.");
  });
});
