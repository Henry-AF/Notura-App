import type { RateLimitPolicy } from "@/lib/api/rate-limit";

export const RATE_LIMIT_POLICIES = {
  meetingsUpload: {
    bucket: "api:meetings/upload",
    limit: 10,
    windowMs: 60_000,
  },
  meetingsProcess: {
    bucket: "api:meetings/process",
    limit: 20,
    windowMs: 60_000,
  },
  assemblyAiToken: {
    bucket: "api:assemblyai/token",
    limit: 30,
    windowMs: 60_000,
  },
  stripeCheckout: {
    bucket: "api:stripe/checkout",
    limit: 10,
    windowMs: 300_000,
  },
  stripeCheckoutVerify: {
    bucket: "api:stripe/checkout/verify",
    limit: 30,
    windowMs: 60_000,
  },
  abacatepayCheckout: {
    bucket: "api:abacatepay/checkout",
    limit: 10,
    windowMs: 300_000,
  },
  abacatepayCheckoutVerify: {
    bucket: "api:abacatepay/checkout/verify",
    limit: 30,
    windowMs: 60_000,
  },
  stripeWebhook: {
    bucket: "api:webhooks/stripe",
    limit: 120,
    windowMs: 60_000,
  },
  abacatepayWebhook: {
    bucket: "api:webhooks/abacatepay",
    limit: 120,
    windowMs: 60_000,
  },
  assemblyAiWebhook: {
    bucket: "api:webhooks/assemblyai",
    limit: 120,
    windowMs: 60_000,
  },
  internalHealth: {
    bucket: "api:internal/health",
    limit: 240,
    windowMs: 60_000,
  },
} as const satisfies Record<string, RateLimitPolicy>;
