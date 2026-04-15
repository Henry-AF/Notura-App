# Secure Direct Upload Design

## Context

The current direct-upload refactor keeps the audio payload out of the Next.js
server, which is desirable for memory usage and request size. However,
`/api/meetings/process` currently trusts a client-provided `r2Key` and starts
the processing pipeline without proving that the key was issued by the server or
that the object exists in R2.

## Goals

- Keep binary uploads client -> R2 only.
- Avoid buffering audio in Next.js memory.
- Prevent clients from submitting arbitrary `r2Key` values to the processing
  route.
- Preserve the existing Inngest transcription/summarization pipeline.
- Limit scope to the `dashboard/new` flow. The `recording` flow is explicitly
  out of scope for now.

## Non-Goals

- No new database table for upload sessions.
- No changes to the `recording` page.
- No redesign of the existing Inngest processing stages.

## Recommended Approach

### 1. Signed upload session token

`POST /api/meetings/upload` will keep generating the presigned R2 PUT URL, but
it will also mint a short-lived HMAC-signed token containing:

- `userId`
- `r2Key`
- `contentType`
- `fileSize`
- `expiresAt`

This token proves that the server issued the upload authorization for that
specific authenticated user and object key.

### 2. Server-side verification before processing

`POST /api/meetings/process` will require the upload token in addition to the
existing metadata. Before creating a meeting or firing the Inngest event, the
route will:

1. Verify the HMAC signature.
2. Reject expired tokens.
3. Require `token.userId === auth.user.id`.
4. Require `token.r2Key === body.r2Key`.
5. Check the object exists in R2 using a metadata/head request.

Only after those checks pass will the route insert the meeting row and send the
`meeting/process` event.

### 3. Pipeline impact

The processing pipeline does not need to change conceptually. Inngest still
receives `meetingId`, `r2Key`, `whatsappNumber`, and `userId`, but the `r2Key`
has now been validated by the server immediately before the job is enqueued.

## Security Properties

- A client cannot swap in an arbitrary `r2Key` without also possessing a valid
  token for that exact key.
- A token issued for one user cannot be replayed by another authenticated user.
- Expired upload sessions are rejected.
- Missing R2 objects are rejected before creating the meeting record and before
  starting downstream processing.

## Data Flow

1. Client requests upload initialization.
2. Server validates request and billing status.
3. Server returns `r2Key`, `uploadUrl`, `uploadToken`, and expiry.
4. Client uploads audio directly to R2 using the presigned PUT URL.
5. Client calls `/api/meetings/process` with meeting metadata, `r2Key`, and
   `uploadToken`.
6. Server verifies token + checks R2 object existence.
7. Server creates the meeting row and enqueues `meeting/process`.

## Files to Change

- `src/app/api/meetings/upload/route.ts`
- `src/app/api/meetings/process/route.ts`
- `src/app/api/meetings/upload/route.test.ts`
- `src/app/api/meetings/process/route.test.ts`
- `src/lib/r2.ts`
- `src/lib/meetings/upload-client.ts`
- `src/app/dashboard/new/page.tsx`
- `.env.example`

## Testing Strategy

- Upload route returns `uploadToken` together with the presigned URL.
- Process route rejects missing or invalid tokens.
- Process route rejects expired tokens.
- Process route rejects mismatched `r2Key`.
- Process route rejects when the R2 object does not exist.
- Existing happy path continues to create the meeting and enqueue Inngest.
