# Lotlé notifications

The existing inbox, event capture, onboarding permission screen, browser subscriptions and push service worker are retained. The delivery worker is deployed as the `drivelink-notifications` Supabase Edge Function.

## Server-side secrets

In Supabase Project Settings → Edge Functions → Secrets, configure these names:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NOTIFICATION_CRON_SECRET`

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key or VAPID private key to the browser.

In Vercel Production (and Preview if used), configure:

- `VITE_VAPID_PUBLIC_KEY` — the public VAPID key only.

In Supabase Vault, create a secret named `lotle_notification_cron_secret` with exactly the same value as `NOTIFICATION_CRON_SECRET`. The notification trigger and pg_cron worker read it from Vault. Do not commit its value to GitHub.

## Browser permission

The onboarding Get notified screen remains. If the dealer skips it, Lotlé can show one contextual bottom sheet after a later first enquiry or vehicle-created event. If browser permission is denied, the contextual prompt is not shown again. On iPhone Safari outside the installed app, the screen explains how to add Lotlé to the Home Screen. The in-app inbox remains available.

## Scheduling

Supabase pg_cron is the production scheduler. The old GitHub Actions timer is disabled; its manual workflow_dispatch remains available as a fallback.

Review and run `supabase/NOTIFICATIONS_CRON.sql` only after:

1. The migration `20261110000300_notifications_delivery_pipeline.sql` is applied.
2. The Edge Function secrets above are configured.
3. The Vault secret `lotle_notification_cron_secret` is created.

The SQL schedules the worker every minute. The worker evaluates unanswered enquiries, trial and renewal reminders, first-vehicle reminders, payment-pending notices and the Monday 08:00 Africa/Harare weekly summary. Immediate enquiry and confirmed-payment notifications wake the worker from the database trigger.

## Event and delivery behavior

- The event definitions live in `supabase/functions/drivelink-notifications/_shared/notificationEvents.ts` and are re-exported to the app from `src/config/notificationEvents.ts`.
- In-app and push channels, category mapping, priority, copy and dedupe keys are defined centrally.
- The worker enforces dealer quiet hours, the 07:00–20:00 Africa/Harare window for scheduled pushes, one non-urgent push per dealer per Harare day, and three total delivery attempts with backoff.
- HTTP 404 and 410 subscriptions are removed. Multiple devices per dealership are supported.
- Payment confirmations remain in the in-app inbox regardless of category preferences.
- The push-subscription Edge Function validates the caller's user token and dealership ownership. The notification worker accepts either the private worker secret or an authenticated owner request for test and plan-limit actions.

## Operational verification

Use the notification inbox to verify in-app delivery and the Settings → Notifications screen to send a test. Check Supabase Edge Function logs and the `notification_attempts` table for push delivery attempts and retries. Browser push still requires a granted permission and a registered device subscription.
