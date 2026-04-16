# Settings Plan Backend Integration Design

**Date:** 2026-04-03
**Status:** Approved for planning

## Goal

Integrate the "Plano" card in dashboard settings with real backend billing data so the page shows the user's current plan, monthly usage, and plan limit without changing the other settings sections or the "Gerenciar plano" button behavior.

## Scope

### In scope

- Load the authenticated user's profile and billing status on the settings page.
- Replace mocked plan name, price, limit, and monthly usage in the "Plano" card with backend-backed values.
- Keep the existing client-side interactivity for the rest of the settings UI.
- Treat `team` as a legacy backend value that should not be reinforced in the UI.
- Support future paid plans with numeric monthly limits by isolating presentation logic from raw backend state.

### Out of scope

- Persisting edits in the "Perfil", "WhatsApp", or "Notificações" sections.
- Implementing any action for the "Gerenciar plano" button.
- Changing billing rules, database schema, or checkout flows.
- Renaming the backend `team` plan to `platinum` in this task.

## Current Context

The settings page at `src/app/dashboard/settings/page.tsx` is a client component with fully mocked state for profile, WhatsApp, notifications, and the plan card. The backend already exposes the necessary billing information through `getBillingStatus(userId)` in `src/lib/billing.ts`, which returns:

- `billingAccount.plan`
- `meetingsThisMonth`
- `monthlyLimit`

The project already uses `createServerSupabase()` for authenticated server-side reads and server actions. No existing test runner is configured in `package.json`, so the implementation must introduce the minimum test harness needed to follow TDD for the new presentation logic.

## Architecture

The settings page will be split into a server wrapper and a client presentation component:

- `src/app/dashboard/settings/page.tsx`
  Loads authenticated user data and backend billing state on the server.
- `src/app/dashboard/settings/settings-client.tsx`
  Holds the interactive UI and existing local state for non-persisted settings sections.
- `src/app/dashboard/settings/plan-presenter.ts`
  Converts backend billing state into UI-ready labels and flags for the plan card.

This keeps data fetching on the server, avoids a client-side loading state for billing, and isolates display rules for the plan card into a testable unit.

## Data Flow

1. The server page creates an authenticated Supabase client with `createServerSupabase()`.
2. The server page calls `auth.getUser()` and redirects the user to `/login` if there is no authenticated user.
3. The server page loads:
   - the user's profile fields needed by the existing UI (`name`, `role`, `company`, `whatsapp_number`) using a tolerant lookup that allows a missing profile row
   - billing status via `getBillingStatus(user.id)`
4. The server page passes initial props into `settings-client.tsx`.
5. The client component renders the existing settings layout and uses `plan-presenter.ts` to render the "Plano" card from backend data.

## Plan Card Presentation Rules

### Raw backend inputs

- `plan`: string from `billing_accounts.plan`
- `meetingsThisMonth`: number from `getBillingStatus`
- `monthlyLimit`: number or `null` from `getBillingStatus`

### Display behavior

#### Free

- Title: `Plano Free`
- Badge label: `Free`
- Price label: `R$0/mês`
- Usage label: `{meetingsThisMonth} de {monthlyLimit} reuniões este mês`
- Progress bar: visible

#### Pro

- Title: `Plano Pro`
- Badge label: `Pro`
- Price label: `R$79/mês`
- Usage label: `{meetingsThisMonth} de {monthlyLimit} reuniões este mês`
- Progress bar: visible

#### Legacy or unknown plan values

- Title: `Plano ativo`
- Badge label: uppercase version of the backend value when available, otherwise `Ativo`
- Price label: omitted unless there is an explicitly known UI mapping
- If `monthlyLimit` is a number:
  - Usage label: `{meetingsThisMonth} de {monthlyLimit} reuniões este mês`
  - Progress bar: visible
- If `monthlyLimit` is `null`:
  - Usage label: `{meetingsThisMonth} reuniões processadas neste mês`
  - Supporting label: `Sem limite mensal`
  - Progress bar: hidden

### Progress calculation

- Only calculate progress when `monthlyLimit` is a positive number.
- Clamp the rendered percentage to the inclusive range `0..100`.
- Avoid division-by-zero behavior.

## Error Handling

- If authenticated user lookup fails, the page should not render mocked billing data.
- If the profile row does not exist, render the page with empty initial values for the profile-driven fields.
- If profile lookup returns a real query error, surface the failure using the app's normal server rendering failure path instead of silently substituting fake values.
- If billing lookup fails, surface the failure instead of rendering stale or invented plan data.
- Unknown backend plan values must not break rendering; they fall back to the neutral legacy display rules above.

## Testing Strategy

The first production-facing logic to be implemented is the pure presenter in `plan-presenter.ts`, following TDD:

1. Add a minimal test runner setup for focused unit tests.
2. Write failing tests for:
   - `free` with numeric limit
   - `pro` with numeric limit
   - unknown or legacy plan with numeric limit
   - unlimited plan display when `monthlyLimit` is `null`
   - progress clamping at `100`
3. Run the tests and confirm they fail for the expected reason.
4. Implement the minimum presenter logic to pass the tests.
5. Wire the presenter into the settings UI.
6. Run the focused tests, then lint, then build if the tree remains healthy enough for a useful build check.

## File Responsibilities

- `src/app/dashboard/settings/page.tsx`
  Server-side data loading and prop assembly only.
- `src/app/dashboard/settings/settings-client.tsx`
  Existing interactive settings UI, fed by initial props.
- `src/app/dashboard/settings/plan-presenter.ts`
  Small pure transformation layer from backend billing data to UI strings/flags.
- `src/app/dashboard/settings/plan-presenter.test.ts`
  Unit tests for plan presentation behavior.

## Future Compatibility

If a new `platinum` plan is introduced later with a numeric limit, the implementation should only need a new UI metadata mapping for display name and price. The general usage rendering rules should already support it without structural changes.
