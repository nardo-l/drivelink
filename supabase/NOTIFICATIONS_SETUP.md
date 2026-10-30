# DriveLink notifications setup

The notification inbox and notification worker are deployed. Browser push delivery stays disabled until the VAPID and scheduler secrets below are configured.

## Generate VAPID keys

Generate a VAPID key pair once (do not regenerate it after users subscribe):

```bash
npx web-push generate-vapid-keys
```

Keep the private key secret. Never commit either key to GitHub.

## Supabase Edge Function secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add:

- `VAPID_PUBLIC_KEY` — the generated public key
- `VAPID_PRIVATE_KEY` — the generated private key
- `VAPID_SUBJECT` — a valid contact URI, e.g. `mailto:YOUR_SUPPORT_EMAIL`
- `NOTIFICATION_CRON_SECRET` — a long random secret (at least 32 characters)

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically. Do not add the service-role key to Vercel or the browser.

## Vercel environment variable

Add this public key to the Vercel project for Production (and Preview if you test there):

- `VITE_VAPID_PUBLIC_KEY` — same value as `VAPID_PUBLIC_KEY`

Redeploy the Vercel app after adding the variable. This is the public VAPID key only.

## GitHub Actions secret

In GitHub → nardo-l/drivelink → Settings → Secrets and variables → Actions, add:

- `NOTIFICATION_CRON_SECRET` — exactly the same value configured in Supabase

The workflow `.github/workflows/drivelink-notifications.yml` invokes the worker every 15 minutes. It creates the daily summary during the 19:00 hour in Africa/Harare and processes queued push notifications.

## Enable browser push

After the Vercel redeployment and secrets are configured, sign into DriveLink, open the dashboard bell → Notifications, and choose **Enable**. Accept the browser permission prompt. Each browser/device must subscribe separately.

## Current behaviour

- New buyer enquiries and vehicle additions create in-app notifications from database events.
- Vehicle-sold changes are recorded and create an in-app notification.
- Showroom copy / WhatsApp / open actions are tracked as share-start events; they stop the share-link reminder campaign. This records the action, not proof that a message was sent.
- The worker creates a daily summary at 19:00 Harare time, inventory reminders, share reminders, enquiry follow-ups, and trial/renewal reminders.
- Push delivery respects per-category preferences and caps non-urgent notifications at two per dealership per rolling 24 hours. New enquiry alerts are treated as urgent.
- Notifications are stored in Supabase and shown in the in-app centre even when browser push is disabled.

## Operational note

The scheduled workflow requires the GitHub Actions secret above. Until it is configured, event-triggered in-app notifications can still be created, but scheduled summaries/reminders and Web Push delivery will not run automatically.
