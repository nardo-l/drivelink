# Lotlé email and authentication manual test checklist

Run these checks against a configured Supabase project with Supabase **Confirm email disabled**.

## Sign-up and email validation

- [ ] Create a new account with a valid Gmail address and password; signup should establish a session and continue directly to onboarding without a confirmation screen.
- [ ] Submit a known disposable-domain address to the signup flow; expect the existing email verifier to reject it when verification is available.
- [ ] Submit a deliberately nonexistent/no-MX domain such as `person@example.invalid`; expect rejection when the verifier can inspect the domain.
- [ ] Submit malformed values such as `person@` and `not-an-email`; expect a syntax error.
- [ ] Submit a typo such as `person@gmial.com`; expect a suggestion when the verifier supplies one.
- [ ] Temporarily enable Confirm email in Supabase and verify that a signup with no returned session shows: “Account created but sign-in is unavailable. Please sign in.”

## Sign-in and account recovery

- [ ] Sign in with email and password.
- [ ] Sign in with Google and confirm the user reaches onboarding or the existing dealership dashboard.
- [ ] From `/login`, click **Forgot password?**, submit a registered email, and confirm that the reset email is sent.
- [ ] Follow the reset link to `/reset-password`, set matching passwords of at least six characters, and confirm the success state.
- [ ] Try mismatched or too-short passwords and confirm they are rejected with clear errors.
- [ ] Sign in with the new password.

## Existing sessions and public showroom

- [ ] Refresh an existing logged-in dealer session; the dashboard and dealership data should restore normally.
- [ ] Open a public showroom and vehicle detail link while signed out; public pages should remain accessible.
- [ ] Confirm that the retired email-confirmation URL no longer renders a confirmation page.
- [ ] Submit buyer enquiries with malformed, disposable, no-MX, and typo-domain email values. Email hints remain advisory; each enquiry must still submit.
- [ ] Block `/api/verify-email` (offline or devtools request blocking) and confirm signup and enquiry submission remain usable.
