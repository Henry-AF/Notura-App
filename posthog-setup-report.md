<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Notura app. The integration covers client-side tracking via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), a shared server-side PostHog client at `src/lib/posthog-server.ts`, and a reverse proxy configuration in `next.config.mjs` to route PostHog requests through `/ingest` to bypass ad-blockers. User identification (`posthog.identify`) is called on signup and login so all client-side and server-side events are correlated by email/user ID. Errors during recording start are captured via `posthog.captureException`.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User created an account via email/password | `src/app/(auth)/signup/page.tsx` |
| `user_logged_in` | User signed in via email/password | `src/app/(auth)/login/page.tsx` |
| `onboarding_phone_saved` | User saved their WhatsApp number in onboarding step 1 | `src/app/(auth)/onboarding/page.tsx` |
| `onboarding_phone_skipped` | User skipped the WhatsApp step during onboarding | `src/app/(auth)/onboarding/page.tsx` |
| `onboarding_plan_selected` | User confirmed plan selection during onboarding (includes `plan`, `billing_cycle`) | `src/app/(auth)/onboarding/page.tsx` |
| `onboarding_checkout_started` | User was redirected to a payment gateway (includes `plan`, `billing_cycle`) | `src/app/(auth)/onboarding/page.tsx` |
| `onboarding_completed` | User reached step 3 and clicked "Go to dashboard" | `src/app/(auth)/onboarding/page.tsx` |
| `meeting_upload_submitted` | User submitted an audio/video file for AI processing (includes `file_type`, `file_size_mb`, `has_group`, `has_whatsapp`) | `src/app/dashboard/recording/page.tsx` |
| `meeting_recording_started` | User started a live in-person or remote recording (includes `recording_mode`, `has_group`, `has_whatsapp`) | `src/app/dashboard/recording/page.tsx` |
| `meeting_retry_clicked` | User clicked retry on a failed meeting (includes `meeting_id`) | `src/app/dashboard/meetings/meetings-client.tsx` |
| `user_logged_out` | User logged out from the dashboard | `src/app/dashboard/dashboard-layout-client.tsx` |
| `checkout_started` | Server-side: billing checkout created for a paid plan upgrade (includes `plan`, `billing_cycle`, `source`) | `src/app/api/billing/checkout/route.ts` |
| `checkout_completed` | Server-side: Stripe checkout completed — user upgraded (includes `plan`, `provider`) | `src/app/api/webhooks/stripe/route.ts` |
| `subscription_canceled` | Server-side: subscription canceled via Stripe or AbacatePay webhook (includes `provider`) | `src/app/api/webhooks/stripe/route.ts`, `src/app/api/webhooks/abacatepay/route.ts` |
| `meeting_quota_exceeded` | Server-side: meeting processing blocked by plan quota (includes `quota_code`, `meetings_used`, `quota_limit`) | `src/app/api/meetings/process/route.ts` |

## LLM Analytics (Google Gemini)

PostHog AI Observability is now instrumented for all Gemini calls using the manual capture approach (`$ai_generation` and `$ai_embedding` events via `posthog-node`). The project uses `@google/generative-ai` (the older SDK), so the OpenTelemetry auto-instrumentation path was not applicable. All LLM events are linked to the Supabase user ID as `distinct_id` and the meeting/chat ID as `$ai_trace_id` for correlation.

| Event | Provider | Model | Span name | File |
|---|---|---|---|---|
| `$ai_generation` | google | `gemini-3.1-flash-lite-preview` or fallback | `generate_meeting_summary` | `src/lib/gemini.ts` |
| `$ai_generation` | google | `gemini-3.1-flash-lite-preview` or fallback | `answer_meeting_question` | `src/lib/gemini.ts` |
| `$ai_embedding` | google | `gemini-embedding-001` | `generate_embedding` | `src/lib/gemini.ts` |

**Properties captured on every event:** `$ai_model`, `$ai_provider`, `$ai_input_tokens`, `$ai_output_tokens` (from `usageMetadata`), `$ai_latency`, `$ai_trace_id`, `$ai_span_name`.

**Callers updated to pass user context:**
- `src/inngest/process-meeting.ts` — passes `userId` + `meetingId` to `generateMeetingSummary`
- `src/inngest/answer-meeting-chat.ts` — passes `userId` + `chatId` to `generateEmbedding` (question embedding) and `answerMeetingQuestionFromChunks`

Batch transcript-chunk embeddings (called during indexing) are not individually captured to avoid noise — only the single per-question embedding during chat is instrumented.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1640452)
- [Signup & Login Activity](/insights/iOckaHlB) — Daily signups and logins over the last 30 days
- [Onboarding Funnel](/insights/u7jKkrKB) — Conversion from signup → plan selected → onboarding complete
- [Meeting Creation Trend](/insights/F1Jf8Wcz) — Meeting uploads and live recordings over time
- [Checkout Conversion Funnel](/insights/XPk512tc) — Conversion from checkout started to completed
- [Subscription Cancellations & Quota Exceeded](/insights/D7gLLByq) — Churn signals over time

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
