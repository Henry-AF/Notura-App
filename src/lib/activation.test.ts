import { describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ rpc }),
}));

import {
  EMPTY_ACTIVATION_METRICS,
  getActivationMetrics,
  mapActivationMetrics,
} from "./activation";

describe("activation metrics", () => {
  it("maps database numerics and preserves a missing median", () => {
    const result = mapActivationMetrics({
      signup_count: 100,
      recording_count: 40,
      delivered_count: 30,
      viewed_count: 20,
      signup_to_recording_pct: 40,
      recording_to_delivered_pct: 75,
      delivered_to_viewed_pct: 66.7,
      activation_rate_pct: 20,
      median_activation_minutes: null,
      in_app_activations: 12,
      whatsapp_activations: 8,
    });

    expect(result).toEqual({
      signupCount: 100,
      recordingCount: 40,
      deliveredCount: 30,
      viewedCount: 20,
      signupToRecordingPct: 40,
      recordingToDeliveredPct: 75,
      deliveredToViewedPct: 66.7,
      activationRatePct: 20,
      medianActivationMinutes: null,
      inAppActivations: 12,
      whatsappActivations: 8,
    });
  });
});

describe("activation metrics availability", () => {
  it("does not break the dashboard while the metrics migration is pending", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find public.get_activation_funnel_metrics in the schema cache",
      },
    });

    await expect(getActivationMetrics()).resolves.toEqual(EMPTY_ACTIVATION_METRICS);
  });

  it("still reports unrelated database failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    await expect(getActivationMetrics()).rejects.toThrow(
      "Failed to load activation metrics: permission denied"
    );
  });
});
