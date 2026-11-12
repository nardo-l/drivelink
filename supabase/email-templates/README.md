# Lotlé Supabase Auth email templates

These files are ready to paste into the matching Supabase Auth email templates. **Custom SMTP must be enabled for this project before Supabase allows custom email templates to be edited.** This README does not change SMTP or any project setting.

## Paste the templates

1. Open **Supabase Dashboard → Authentication → Emails → Templates**.
2. Open the template named below.
3. Copy the complete contents of its matching `.html` file into the HTML editor.
4. If the dashboard provides a plain-text editor, paste the matching `.txt` file there.
5. Set the subject to the exact subject shown below, then save that template.
6. Repeat for all four templates.

| Supabase template | HTML file | Plain-text file | Subject |
|---|---|---|---|
| Confirm signup | `confirm-signup.html` | `confirm-signup.txt` | **Confirm your Lotlé email** |
| Reset password | `reset-password.html` | `reset-password.txt` | **Reset your Lotlé password** |
| Change email address | `change-email.html` | `change-email.txt` | **Confirm your new Lotlé email** |
| Reauthentication | `reauthentication.html` | `reauthentication.txt` | **Your Lotlé verification code** |

The suggested subjects are also collected in [subjects.md](./subjects.md).

## Template notes

- Signup confirmation and reauthentication use the six-digit `{{ .Token }}` as the primary action. The user enters the code in Lotlé; these templates do not use a link-only confirmation flow.
- Password reset uses `{{ .ConfirmationURL }}` for both the button and the visible fallback link.
- Email change uses `{{ .ConfirmationURL }}` and displays the target address with `{{ .NewEmail }}`.
- No code expiry duration is assumed. Token emails say: “This code expires shortly.”
- Support details come from the repository brand configuration: **support@lotle.link** and **+263 789 113 734** (WhatsApp).
- Brand name: **Lotlé**, taken from `src/config/brand.ts`. The repository also contains the ASCII spelling **Lotle**, the legacy name **DriveLink**, and the domain `lotle.link`; the templates use only the configured brand name, Lotlé.

## Design

The templates use a responsive, table-based layout with inline CSS, a 600px maximum content width, no scripts, no remote images, and no external font requests. Inter is the first-choice brand UI font with web-safe fallbacks. The app also uses DM Serif Display for selected headings, but the email templates use the Inter stack for predictable email-client rendering.

The palette follows the repository's current brand refinements: warm off-white `#FAF9F6`, white surfaces, ink `#171717`, copper `#C96B3D` and its darker accessible action shade `#9E4F2E`, with `#D9D6CF` borders. The logo is rendered as a text wordmark to avoid remote image dependencies.
