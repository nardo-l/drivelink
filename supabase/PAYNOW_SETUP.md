# Paynow EcoCash subscriptions

DriveLink subscriptions are manually renewed through Paynow using EcoCash.

- Price: USD 3.99 per 30-day period.
- Grace period: 3 days after the paid-through date.
- Renewal is customer-initiated. DriveLink does not store EcoCash credentials or charge customers automatically.
- A subscription is activated or extended only after the Paynow result notification has a valid SHA-512 hash and a separate Paynow poll confirms the transaction as `Paid`.

## Supabase Edge Function secrets

In the Supabase Dashboard, open the DriveLink project, then **Edge Functions → Secrets**, and add:

| Secret | Value |
| --- | --- |
| `PAYNOW_INTEGRATION_ID` | `27789` |
| `PAYNOW_INTEGRATION_KEY` | Your private Paynow integration key |
| `DRIVELINK_APP_URL` | The production DriveLink origin, e.g. `https://your-domain.example` (no trailing slash) |

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically. Never put the Paynow integration key in a `VITE_*` variable or browser code.

## Paynow configuration

Configure the Paynow integration to allow EcoCash payments. Paynow redirects the customer to its hosted checkout, where they choose EcoCash from the payment methods enabled for the integration.

The result URL is:
`https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/drivelink-payments`

Paynow posts payment status to this URL. The function validates the signature, polls Paynow, checks the exact reference and amount, and calls the database activation function only for a confirmed `Paid` status.

## Customer flow

1. The signed-in dealership owner opens **Settings → Subscription**.
2. They choose Subscribe or Renew for USD 3.99.
3. DriveLink creates a unique payment reference and redirects to Paynow.
4. The customer chooses EcoCash and authorises the payment.
5. Paynow confirms the payment server-to-server; DriveLink extends the subscription by 30 days.
6. The customer returns to the billing page to see the latest status and payment history.

The return page is not treated as proof of payment. If the customer returns before Paynow's server notification arrives, they can refresh the billing page after a short wait.
