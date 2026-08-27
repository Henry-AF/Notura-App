import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ActivationFunnel } from "./ActivationFunnel";

it("shows gate conversions, activation rate, median and channels", () => {
  const html = renderToStaticMarkup(<ActivationFunnel metrics={{
    signupCount: 100, recordingCount: 40, deliveredCount: 30, viewedCount: 20,
    signupToRecordingPct: 40, recordingToDeliveredPct: 75,
    deliveredToViewedPct: 66.7, activationRatePct: 20,
    medianActivationMinutes: 90, inAppActivations: 12, whatsappActivations: 8,
  }} />);

  expect(html).toContain("20%");
  expect(html).toContain("mediana 1.5 h");
  expect(html).toContain("12 in-app · 8 WhatsApp");
  expect(html).toContain("66.7% do gate anterior");
});
