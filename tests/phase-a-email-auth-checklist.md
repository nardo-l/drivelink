# Phase A email and authentication manual test checklist

Run these checks against a configured Supabase project. Do not enable Confirm email or apply any Phase B SQL/dashboard changes as part of this checklist.

## Email validation endpoint and signup

- [ ] Submit `normaluser@gmail.com` to `/api/verify-email`; expect HTTP 200, `valid: true`, and `has_mx_records: true`. Complete signup and confirm that the account reaches the 6-digit confirmation screen.
- [ ] Submit a known disposable-domain address; expect HTTP 200 with `valid: false` and `reason: "disposable"`. Signup should show the returned error and not continue.
- [ ] Submit an address at a deliberately nonexistent/no-MX domain such as `person@example.invalid`; expect rejection with `reason: "mx"` (or an HTTP rejection if the verifier cannot inspect the domain).
- [ ] Submit malformed values such as `person@` and `not-an-email`; expect a syntax error.
- [ ] Submit a typo such as `person@gmial.com`; expect a visible suggestion such as `Did you mean person@gmail.com?` when the verifier supplies one.

## Confirmation gate and OTP

- [ ] After signup, visit `/onboarding` and `/app` before confirmation; both must show the confirmation screen rather than onboarding or app content. Refresh the page and repeat.
- [ ] Enter a valid 6-digit signup code; `supabase.auth.verifyOtp({ email, token, type: 'signup' })` should confirm the user and return to `/onboarding`.
- [ ] Enter a wrong code; remain on the screen with a clear incorrect-code error.
- [ ] Use an expired code; remain on the screen with a clear expired-code error.
- [ ] Click **Resend code**; receive a new code, see the cooldown timer, and verify that the new code works.

## Password recovery

- [ ] From `/login`, click **Forgot password?**, submit a registered email, and confirm that the reset email is sent.
- [ ] Follow the reset link to `/reset-password`, set matching passwords of at least six characters, and confirm the success state.
- [ ] Try mismatched or too-short passwords and confirm they are rejected with clear errors.
- [ ] Sign in with the new password.

## Google and enquiry behavior

- [ ] Sign in with Google; the callback must not send the user to email confirmation when Supabase marks the identity confirmed, and the user can reach onboarding/app normally.
- [ ] Submit a buyer enquiry with a malformed email, disposable email, no-MX email, and typo-domain email. Hints appear when the email field loses focus. Each enquiry must still be saved/sent; validation feedback is advisory only.
- [ ] Block `/api/verify-email` (offline or devtools request blocking) and confirm signup still proceeds and an enquiry still submits.
