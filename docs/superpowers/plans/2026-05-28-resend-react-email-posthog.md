# Resend React Email PostHog Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send welcome and 3-day inactivity emails with Resend + React Email, attribute returns in PostHog, and keep all email/billing/user lookups server-side.

**Architecture:** Email templates live under `src/emails`, Resend access lives under `src/lib/email`, and triggers run through secure server-side paths: an authenticated signup API route, an Inngest daily job, and a secret-protected PostHog webhook endpoint. Idempotency is enforced in a new `email_deliveries` table so PostHog and app-side triggers cannot double-send the same campaign.

**Tech Stack:** Next.js App Router, Supabase service role, Inngest cron/events, Resend, React Email, PostHog.

---

## Chunk 1: Dependencies And Email Core

### Task 1: Install Email Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install dependencies**

Run: `npm install resend react-email`
Expected: dependencies are added to `package.json` and lockfile.

### Task 2: Add Email Delivery Schema

**Files:**
- Create: `supabase/migrations/026_email_deliveries.sql`
- Modify: `src/types/database.ts`
- Test: `tests/email-delivery-schema.test.ts`

- [ ] **Step 1: Write failing schema test**
- [ ] **Step 2: Run `npm test tests/email-delivery-schema.test.ts` and verify failure**
- [ ] **Step 3: Add migration and TypeScript table types**
- [ ] **Step 4: Re-run schema test and verify pass**

### Task 3: Add React Email Templates And Resend Client

**Files:**
- Create: `src/emails/notura-email-shell.tsx`
- Create: `src/emails/welcome-email.tsx`
- Create: `src/emails/inactivity-email.tsx`
- Create: `src/lib/email/resend.ts`
- Create: `src/lib/email/campaigns.ts`
- Test: `src/lib/email/campaigns.test.ts`

- [ ] **Step 1: Write failing tests for subject/copy/link/campaign data**
- [ ] **Step 2: Run `npm test src/lib/email/campaigns.test.ts` and verify failure**
- [ ] **Step 3: Implement templates, URL builder, estimated time saved copy, quota copy, and Resend wrapper**
- [ ] **Step 4: Re-run tests and verify pass**

## Chunk 2: Triggers And Tracking

### Task 4: Add Signup Welcome Trigger

**Files:**
- Create: `src/app/api/email/welcome/route.ts`
- Modify: `src/app/(auth)/signup/page.tsx`
- Test: `src/app/api/email/welcome/route.test.ts`

- [ ] **Step 1: Write failing route test**
- [ ] **Step 2: Run route test and verify failure**
- [ ] **Step 3: Implement auth-only route that sends one welcome email per user**
- [ ] **Step 4: Call route after successful signup without sending email data from the client**
- [ ] **Step 5: Re-run tests**

### Task 5: Add PostHog Webhook Trigger

**Files:**
- Create: `src/app/api/email/posthog/route.ts`
- Test: `src/app/api/email/posthog/route.test.ts`

- [ ] **Step 1: Write failing tests for secret validation and welcome trigger payload**
- [ ] **Step 2: Run route test and verify failure**
- [ ] **Step 3: Implement secret-protected allowlisted PostHog trigger route**
- [ ] **Step 4: Re-run tests**

### Task 6: Add Inactivity Email Job

**Files:**
- Create: `src/inngest/user-inactivity-email.ts`
- Modify: `src/app/api/inngest/route.ts`
- Test: `src/inngest/user-inactivity-email.test.ts`

- [ ] **Step 1: Write failing tests for 3-day inactivity selection and quota-specific copy**
- [ ] **Step 2: Run test and verify failure**
- [ ] **Step 3: Implement daily cron job using Supabase Auth Admin and billing data**
- [ ] **Step 4: Register Inngest function**
- [ ] **Step 5: Re-run tests**

### Task 7: Add Email Return Attribution

**Files:**
- Create: `src/components/analytics/email-return-tracker.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/components/analytics/email-return-tracker.test.tsx`

- [ ] **Step 1: Write failing test for UTM/email tracking event**
- [ ] **Step 2: Run test and verify failure**
- [ ] **Step 3: Implement client tracker that captures `email_returned_to_app`**
- [ ] **Step 4: Re-run tests**

## Chunk 3: Verification

### Task 8: Final Checks

**Files:**
- All changed files

- [ ] **Step 1: Run focused tests**

Run: `npm test tests/email-delivery-schema.test.ts src/lib/email/campaigns.test.ts src/app/api/email/welcome/route.test.ts src/app/api/email/posthog/route.test.ts src/inngest/user-inactivity-email.test.ts src/components/analytics/email-return-tracker.test.tsx`

- [ ] **Step 2: Run lint**

Run: `npm run lint:strict`

- [ ] **Step 3: Run build**

Run: `npm run build`
