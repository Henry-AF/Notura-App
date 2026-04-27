# Billing Quota Periods Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce lifetime free quotas and paid subscription-period quotas driven only by payment renewal webhooks.

**Architecture:** Keep billing state in `billing_accounts`, enforce quota consumption in a service-role-only RPC, and centralize period reset/downgrade helpers in `src/lib/billing.ts`. API routes use preflight checks for user feedback and atomic consumption before processing work is queued.

**Tech Stack:** Next.js route handlers, Supabase Postgres migrations/RPC, Vitest unit tests, Stripe and AbacatePay webhooks.

---

## Chunk 1: Data Model And Billing Helpers

### Task 1: Migration And Types

**Files:**
- Modify: `supabase/migrations/012_atomic_increment_billing_usage.sql`
- Modify: `src/types/database.ts`
- Test: `tests/billing-rpc-policy.test.ts`

- [ ] Add `meetings_used`, `current_period_start`, and `current_period_end`.
- [ ] Backfill `meetings_used` from all historical `meetings` rows.
- [ ] Replace the increment-only RPC with a service-role-only quota consumption RPC.
- [ ] Update database TypeScript types and the migration policy test.

### Task 2: Billing Helper Contract

**Files:**
- Modify: `src/lib/billing.ts`
- Modify: `src/lib/billing.test.ts`

- [ ] Write failing tests for free lifetime quota, paid expired quota, Pro limit, Platinum limit, period reset, downgrade, and refund.
- [ ] Implement `getMeetingQuotaStatus`, `consumeMeetingQuota`, `refundMeetingQuota`, `resetSubscriptionPeriod`, and `downgradeToFree`.
- [ ] Keep backward-compatible response fields where routes/UI still expect `meetingsThisMonth` and `monthlyLimit`.

## Chunk 2: Routes And Webhooks

### Task 3: Upload And Process Routes

**Files:**
- Modify: `src/app/api/meetings/upload/route.ts`
- Modify: `src/app/api/meetings/upload/route.test.ts`
- Modify: `src/app/api/meetings/process/route.ts`
- Modify: `src/app/api/meetings/process/route.test.ts`

- [ ] Write failing route tests for free lifetime exhaustion and expired paid periods.
- [ ] Use preflight quota status in upload/process.
- [ ] Consume quota atomically before insert/enqueue and refund on insert/enqueue failure.

### Task 4: Payment Webhooks

**Files:**
- Modify: `src/app/api/webhooks/abacatepay/route.ts`
- Modify: `src/app/api/webhooks/abacatepay/route.test.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`
- Create: `src/app/api/webhooks/stripe/route.test.ts`
- Modify: `src/app/api/abacatepay/checkout/verify/route.ts`

- [ ] Write failing webhook tests for activation/renewal reset and cancellation downgrade.
- [ ] Route successful activation and renewal events through `resetSubscriptionPeriod`.
- [ ] Route cancellation events through `downgradeToFree`.

## Chunk 3: Verification

- [ ] Run focused tests for billing, upload/process, and webhooks.
- [ ] Run `npm test`.
