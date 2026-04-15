# Secure Direct Upload Implementation Plan

> **For agentic workers:** REQUIRED: Use $subagent-driven-development (if subagents available) or $executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure the direct-to-R2 upload flow for `dashboard/new` without sending audio through the Next.js server.

**Architecture:** Keep upload initialization and processing as two separate API calls, but bind them with a short-lived signed upload token and verify object existence in R2 before inserting the meeting and enqueuing Inngest.

**Tech Stack:** Next.js App Router, Vitest, Cloudflare R2 via AWS SDK, Inngest, Node crypto

---

## Chunk 1: Lock Down the Server Contract

### Task 1: Add failing tests for secure process validation

**Files:**
- Modify: `src/app/api/meetings/process/route.test.ts`
- Test: `src/app/api/meetings/process/route.test.ts`

- [ ] Add a test for rejecting an invalid upload token.
- [ ] Run `npm test -- src/app/api/meetings/process/route.test.ts` and confirm it fails for the new test.
- [ ] Add a test for rejecting a tampered `r2Key`.
- [ ] Run the same command and confirm it still fails for the new behavior.
- [ ] Add a test for rejecting a missing R2 object.
- [ ] Run the same command and confirm it fails for the new behavior.

### Task 2: Add failing tests for upload initialization response

**Files:**
- Modify: `src/app/api/meetings/upload/route.test.ts`
- Test: `src/app/api/meetings/upload/route.test.ts`

- [ ] Add a test asserting the upload route returns `uploadToken`.
- [ ] Run `npm test -- src/app/api/meetings/upload/route.test.ts` and confirm it fails.

## Chunk 2: Implement the Secure Upload Session

### Task 3: Add upload-token signing helpers

**Files:**
- Modify: `.env.example`
- Create or modify: `src/lib/meetings/upload-token.ts`

- [ ] Add an env entry for the upload token secret.
- [ ] Implement helpers to sign and verify a short-lived token with HMAC.
- [ ] Keep the payload limited to `userId`, `r2Key`, `contentType`, `fileSize`, and `expiresAt`.

### Task 4: Expose R2 existence checks

**Files:**
- Modify: `src/lib/r2.ts`

- [ ] Add a helper that checks whether an object exists for a given key.
- [ ] Keep it based on R2 metadata/head access so the server never downloads the audio body.

### Task 5: Update upload route to mint signed upload tokens

**Files:**
- Modify: `src/app/api/meetings/upload/route.ts`

- [ ] Generate the signed upload token after building the `r2Key`.
- [ ] Return the token in the JSON response together with the presigned PUT URL.
- [ ] Keep billing and file validations unchanged unless needed for the token payload.

## Chunk 3: Secure Processing and Update the Client Flow

### Task 6: Update process route to verify upload authorization

**Files:**
- Modify: `src/app/api/meetings/process/route.ts`

- [ ] Require `uploadToken` in the request body.
- [ ] Verify token signature and expiry.
- [ ] Reject requests where token `userId` or `r2Key` do not match the authenticated request.
- [ ] Check object existence in R2 before inserting the meeting row.
- [ ] Preserve the current billing guard and Inngest enqueue behavior.

### Task 7: Update the new-meeting client flow

**Files:**
- Modify: `src/lib/meetings/upload-client.ts`
- Modify: `src/app/dashboard/new/page.tsx`

- [ ] Capture `uploadToken` from the upload-init response.
- [ ] Send `uploadToken` when calling `/api/meetings/process`.
- [ ] Keep the direct PUT upload and progress UI intact.
- [ ] Do not change `recording/page.tsx`.

## Chunk 4: Verify

### Task 8: Run focused tests

**Files:**
- Test: `src/app/api/meetings/upload/route.test.ts`
- Test: `src/app/api/meetings/process/route.test.ts`

- [ ] Run `npm test -- src/app/api/meetings/upload/route.test.ts src/app/api/meetings/process/route.test.ts`.
- [ ] Confirm all focused tests pass.
- [ ] Summarize any residual risk, especially around abandoned uploads in R2.
