# Centralized Route Auth and Ownership Design

**Date:** 2026-04-07

## Goal

Centralize API route authentication and resource ownership checks behind shared helpers so protected routes stop repeating `auth.getUser()` and manual `user_id` validation logic.

## Scope

This design covers:

- A shared auth wrapper for Next.js route handlers
- A shared ownership assertion for row-level resources
- Migration of the current resource routes that manually check ownership
- Migration of `src/app/api/meetings/[id]/route.ts` in the same delivery

This design does not remove or weaken Supabase RLS. RLS remains the final safety net.

## Security Model

Protected routes will use three layers:

1. Supabase RLS remains enabled and unchanged
2. `requireAuth()` returns `401` when there is no authenticated session
3. `requireOwnership()` returns `403` for any ownership failure, including missing resources

The `403`-for-all ownership failures behavior intentionally avoids revealing whether a resource exists.

## Proposed API

Create a shared helper module at `src/lib/api/auth.ts`.

### `requireAuth()`

Responsibilities:

- Create the request-scoped Supabase client
- Call `auth.getUser()`
- Throw `NextResponse.json({ error: "Não autenticado." }, { status: 401 })` when the session is missing or invalid
- Return an auth context with:
  - `user`
  - `supabase`
  - `supabaseAdmin`

### `requireOwnership(supabaseAdmin, table, resourceId, userId)`

Responsibilities:

- Query the target row using the service-role client
- Select only `id` and `user_id`
- Compare the row `user_id` with the authenticated user id
- Throw `NextResponse.json({ error: "Acesso negado." }, { status: 403 })` when:
  - the row does not exist
  - the query fails
  - the row belongs to another user

### `withAuth(handler)`

Responsibilities:

- Wrap a Next.js route handler
- Resolve auth once per request through `requireAuth()`
- Inject `{ auth }` into the route context
- Catch any thrown `NextResponse` from `requireAuth()` or `requireOwnership()` and return it directly
- Let non-auth business errors stay local to the route

## Route Shape After Migration

Protected routes should become explicit but compact:

```ts
export const DELETE = withAuth(async (_req, { params, auth }) => {
  await requireOwnership(auth.supabaseAdmin, "meetings", params.id, auth.user.id);

  // route-specific logic
});
```

This keeps route business logic visible while removing repeated auth and ownership boilerplate.

## Affected Routes

First delivery includes:

- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/meetings/[id]/retry/route.ts`
- `src/app/api/meetings/[id]/status/route.ts`
- `src/app/api/meetings/[id]/resend/route.ts`
- `src/app/api/meetings/[id]/route.ts`

These routes currently duplicate ownership checks and benefit immediately from the helper.

## Error Handling

Rules:

- Missing session stays `401`
- Ownership failures always become `403`
- Route-specific validation errors remain local, such as `400`, `409`, `422`, and `500`
- `withAuth()` only handles auth-layer responses, not generic application exceptions

This prevents the wrapper from obscuring domain-specific failures.

## Testing Strategy

Add focused tests before implementation:

1. Unit tests for `src/lib/api/auth.ts`
2. Route-level regression tests for at least one migrated ownership route

Minimum coverage:

- `withAuth()` returns `401` without a user
- `withAuth()` injects `auth` into the wrapped handler
- `requireOwnership()` succeeds when `user_id` matches
- `requireOwnership()` returns `403` when the row is missing
- `requireOwnership()` returns `403` when the row belongs to another user
- Migrated route still returns the same success payload on the happy path

## Tradeoffs

### Benefits

- Less repeated auth boilerplate
- Lower risk of forgetting ownership checks
- Consistent `401` and `403` behavior
- Easier future migration of remaining authenticated routes

### Costs

- Introduces a small abstraction layer for route handlers
- Requires route signatures to move to the wrapped context pattern
- Ownership checks still require an explicit call in each route that targets a user-owned resource

## Adoption Notes

The first rollout should focus on ownership-sensitive routes only. Auth-only routes can migrate later to `withAuth()` without `requireOwnership()` once the pattern is proven stable.
