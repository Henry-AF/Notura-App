import type { RateLimitPolicy } from "@/lib/api/rate-limit";

export const RATE_LIMIT_POLICIES = {
  meetingsUpload: {
    bucket: "api:meetings/upload",
    limit: 20,
    windowMs: 60_000,
  },
  meetingsProcess: {
    bucket: "api:meetings/process",
    limit: 10,
    windowMs: 60_000,
  },
  meetingAiChatCreate: {
    bucket: "api:meetings/[id]/chats",
    limit: 2,
    windowMs: 60_000,
  },
  meetingRetry: {
    bucket: "api:meetings/[id]/retry",
    limit: 5,
    windowMs: 60_000,
  },
  meetingResend: {
    bucket: "api:meetings/[id]/resend",
    limit: 5,
    windowMs: 60_000,
  },
  meetingExport: {
    bucket: "api:meetings/[id]/export",
    limit: 20,
    windowMs: 60_000,
  },
  meetingParticipantsRead: {
    bucket: "api:meetings/[id]/participants",
    limit: 60,
    windowMs: 60_000,
  },
  meetingParticipantsMutate: {
    bucket: "api:meetings/[id]/participants/[participantId]",
    limit: 30,
    windowMs: 60_000,
  },
  meetingGroupsCreate: {
    bucket: "api:meeting-groups",
    limit: 20,
    windowMs: 60_000,
  },
  meetingGroupsMutate: {
    bucket: "api:meeting-groups/[id]",
    limit: 30,
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
  billingCheckout: {
    bucket: "api:billing/checkout",
    limit: 10,
    windowMs: 300_000,
  },
  billingCheckoutVerify: {
    bucket: "api:billing/checkout/verify",
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
    limit: 30,
    windowMs: 60_000,
  },
  abacatepayWebhook: {
    bucket: "api:webhooks/abacatepay",
    limit: 30,
    windowMs: 60_000,
  },
  assemblyAiWebhook: {
    bucket: "api:webhooks/assemblyai",
    limit: 30,
    windowMs: 60_000,
  },
  internalHealth: {
    bucket: "api:internal/health",
    limit: 240,
    windowMs: 60_000,
  },
} as const satisfies Record<string, RateLimitPolicy>;
