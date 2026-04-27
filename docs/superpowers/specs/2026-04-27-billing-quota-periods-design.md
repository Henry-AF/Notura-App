# Billing Quota Periods Design

## Goal

Move meeting quota from calendar-month counting to billing-controlled usage:
free users get 3 lifetime meetings, Pro users get 30 meetings per active paid
period, and Platinum (`team`) users get 100 meetings per active paid period.

## Data Model

`billing_accounts` stores quota state directly:

- `meetings_used integer not null default 0`
- `current_period_start timestamptz`
- `current_period_end timestamptz`

The migration backfills `meetings_used` from all historical `meetings` rows per
user. Free users never reset. Paid users only reset from a successful payment or
renewal webhook.

## Quota Rules

- Free: `meetings_used < 3` allows processing; once it reaches 3 it is a
  lifetime block.
- Pro: requires `current_period_end > now()` and `meetings_used < 30`.
- Platinum: requires `current_period_end > now()` and `meetings_used < 100`.
- Expired paid periods block processing until a successful renewal webhook resets
  the subscription period.

## Billing Events

Successful subscription activation and renewal call `resetSubscriptionPeriod`,
which sets the paid plan, resets `meetings_used` to `0`, and writes a new
one-month period. Cancellation calls `downgradeToFree`, which sets `plan =
'free'`, clears period timestamps, and leaves `meetings_used` intact.

## Processing Flow

Upload and process routes perform a preflight quota check for quick feedback.
The final `/api/meetings/process` route consumes quota atomically after upload
validation and before enqueueing. If the meeting insert or enqueue fails after
consumption, the server refunds one usage unit.
