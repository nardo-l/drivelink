export type EmailVerificationResult = {
  valid: boolean;
  message: string;
  checked: boolean;
  suggestion?: string;
  free?: boolean;
  roleAccount?: boolean;
};

type ApiResult = {
  valid: boolean;
  reason?: string;
  suggestion?: string;
  mx_checked?: boolean;
  free?: boolean;
  role_account?: boolean;
};

export async function verifyEmailAddress(email: string): Promise<EmailVerificationResult> {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, message: 'Enter a valid email address.', checked: true };
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('/api/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Email verifier returned HTTP ${response.status}`);
    const result = await response.json() as ApiResult;

    let message = '';
    if (result.reason === 'syntax') {
      message = 'Enter a valid email address.';
    } else if (result.reason === 'disposable') {
      message = 'Please use a regular email address rather than a temporary or disposable address.';
    } else if (result.reason === 'mx') {
      message = 'This email domain does not appear to accept email. Check the spelling and try again.';
    } else if (result.suggestion) {
      message = `Did you mean ${email.split('@')[0]}@${result.suggestion}?`;
    }

    return {
      valid: result.valid,
      message,
      checked: result.mx_checked === true,
      suggestion: result.suggestion,
      free: result.free,
      roleAccount: result.role_account,
    };
  } catch (error) {
    console.warn('Email verification is temporarily unavailable.', error);
    // Fail open: an unavailable verifier must never block signup or enquiries.
    // Callers can tell the check did not run because `checked` is false.
    return { valid: true, message: '', checked: false };
  } finally {
    window.clearTimeout(timeout);
  }
}
